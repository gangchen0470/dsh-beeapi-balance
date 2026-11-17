import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');

test('compact balance schedules low-frequency polls and cleans them up', () => {
  const intervals = [], cleared = [], listeners = new Map(), registrations = [];
  let cleanup;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useSyncExternalStore() {},
    useState(initial) { return [initial, () => {}]; },
    useEffect(effect) { cleanup = effect(); }
  };
  const document = {
    hidden: true,
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); }
  };
  let bundle;
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(value) { bundle = value; } } },
    document,
    AbortController,
    setInterval(fn, ms) { const timer = { fn, ms }; intervals.push(timer); return timer; },
    clearInterval(timer) { cleared.push(timer); },
    fetch() { throw new Error('hidden component must not issue a request'); }
  });
  vm.runInContext(source, context, { filename: 'client.js' });
  assert.equal(bundle.id, '@local/beeapi-dashboard');
  const plugin = bundle.factory(name => {
    assert.equal(name, 'react');
    return React;
  });
  plugin.apply({
    effect() {},
    locale: { register() {}, bind() { return () => ''; }, subscribe() {}, getSnapshot() {} },
    slots: {
      inject(name, register) { register(); },
      register(options, component) { registrations.push({ options, component }); }
    }
  });
  const compact = registrations.find(item => item.options.name === 'conversation.composer.dock');
  assert.ok(compact);
  compact.component();
  assert.deepEqual(intervals.map(timer => timer.ms), [600000, 60000]);
  assert.ok(listeners.has('visibilitychange'));
  assert.equal(typeof cleanup, 'function');
  cleanup();
  assert.deepEqual(cleared, intervals);
  assert.equal(listeners.size, 0);
});

test('visible state poll stays local while scheduled refresh uses the balance route', async () => {
  const intervals = [], requests = [];
  let cleanup, bundle;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useSyncExternalStore() {},
    useState(initial) { return [initial, () => {}]; },
    useEffect(effect) { cleanup = effect(); }
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(value) { bundle = value; } } },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    AbortController,
    setInterval(fn, ms) { intervals.push({ fn, ms }); return fn; },
    clearInterval() {},
    fetch: async (url) => {
      requests.push(url);
      return { ok: true, async json() { return { connected: true, balance: { available: 1, currency: 'USD' } }; } };
    }
  });
  vm.runInContext(source, context, { filename: 'client.js' });
  const plugin = bundle.factory(() => React);
  let compact;
  plugin.apply({
    effect() {},
    locale: { register() {}, bind() { return () => ''; }, subscribe() {}, getSnapshot() {} },
    slots: { inject(_name, register) { register(); }, register(options, component) { if (options.name === 'conversation.composer.dock') compact = component; } }
  });
  compact();
  await new Promise(resolve => setImmediate(resolve));
  requests.length = 0;
  intervals.find(item => item.ms === 60000).fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['/api/local-beeapi/state']);
  requests.length = 0;
  intervals.find(item => item.ms === 600000).fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['/api/local-beeapi/state', '/api/local-beeapi/refresh']);
  cleanup();
});

test('open main panel receives balance updates from compact state polling', async () => {
  const intervals = [], cleanups = [], registrations = [], panelStates = [];
  let panelRendering = false, bundle;
  const document = { hidden: true, addEventListener() {}, removeEventListener() {} };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useSyncExternalStore() {},
    useState(initial) { const isPanel = panelRendering; return [initial, value => { if (isPanel && typeof value !== 'function' && value?.balance) panelStates.push(value); }]; },
    useRef(initial) { return { current: initial }; },
    useEffect(effect) { cleanups.push(effect()); }
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(value) { bundle = value; } } }, document, AbortController,
    setInterval(fn, ms) { intervals.push({ fn, ms }); return fn; }, clearInterval() {},
    fetch: async url => ({ ok: true, async json() { return url.endsWith('/state') ? { connected: true, balance: { available: 42, currency: 'USD' } } : { connected: true, balance: { available: 42, currency: 'USD' } }; } })
  });
  vm.runInContext(source, context, { filename: 'client.js' });
  bundle.factory(() => React).apply({
    effect() {}, locale: { register() {}, bind() { return () => ''; }, subscribe() {}, getSnapshot() {} },
    slots: { inject(_name, register) { register(); }, register(options, component) { registrations.push({ options, component }); } }
  });
  registrations.find(item => item.options.name === 'conversation.composer.dock').component();
  panelRendering = true;
  registrations.find(item => item.options.name === 'main').component({ settingsPage: false });
  panelRendering = false;
  await new Promise(resolve => setImmediate(resolve));
  const before = panelStates.length;
  document.hidden = false;
  intervals.find(item => item.ms === 60000).fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(panelStates.length > before);
  assert.equal(panelStates.at(-1).balance.available, 42);
  for (const cleanup of cleanups.reverse()) cleanup();
});

test('visibility recovery skips recent upstream refresh and refreshes stale balance', async () => {
  const listeners = new Map(), requests = [];
  let bundle, cleanup, updatedAt = new Date(Date.now()).toISOString();
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useSyncExternalStore() {},
    useState(initial) { return [initial, () => {}]; },
    useEffect(effect) { cleanup = effect(); }
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(value) { bundle = value; } } },
    document: { hidden: true, addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); } },
    AbortController,
    setInterval(fn) { return fn; }, clearInterval() {},
    fetch: async url => {
      requests.push(url);
      return { ok: true, async json() { return { connected: true, updatedAt, balance: { available: 1, currency: 'USD' } }; } };
    }
  });
  vm.runInContext(source, context, { filename: 'client.js' });
  const plugin = bundle.factory(() => React);
  let compact;
  plugin.apply({
    effect() {}, locale: { register() {}, bind() { return () => ''; }, subscribe() {}, getSnapshot() {} },
    slots: { inject(_name, register) { register(); }, register(options, component) { if (options.name === 'conversation.composer.dock') compact = component; } }
  });
  compact();
  context.document.hidden = false;
  listeners.get('visibilitychange')();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['/api/local-beeapi/state']);
  requests.length = 0;
  updatedAt = new Date(Date.now() - 600001).toISOString();
  listeners.get('visibilitychange')();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['/api/local-beeapi/state', '/api/local-beeapi/refresh']);
  cleanup();
  assert.equal(listeners.size, 0);
});

test('manual refresh and host turn listener stay available', async () => {
  assert.match(source, /button\('refresh',\(\)=>load\('refresh',\{\}\)\)/);
  const host = await readFile(new URL('./index.js', import.meta.url), 'utf8');
  assert.match(host, /ctx\.on\('session\/event'/);
  assert.match(host, /event\.data\?\.reason\?\.kind !== 'completed'/);
});
