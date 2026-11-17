import test from 'node:test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createBalance, createResource, CREDENTIAL_KEY, USAGE_URL } from './oauth.js';
import { apply } from './index.js';
const owner = { principal: { kind: 'owner' } };
function store() {
  const validate = key => assert.match(key, /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/);
  let record;
  return {
    reads: [], writes: 0,
    async readRecord(key) { validate(key); this.reads.push(key); return record; },
    async modifyRecord(key, fn) { validate(key); assert.equal(key, CREDENTIAL_KEY); const next = await fn(record); if (next !== undefined) record = next; this.writes++; return record; },
    async deleteRecord(key) { validate(key); assert.equal(key, CREDENTIAL_KEY); record = undefined; }
  };
}
function mock(data = { balance: 12.5, currency: 'USD' }) {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return Response.json(data); };
  return { calls, fetchImpl };
}
function post(body = {}, extra = {}) {
  return new Request('http://localhost:62763/api/local-beeapi/connect', { method: 'POST', headers: { origin: 'http://localhost:62763', 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
}
test('connect validates before saving; only dedicated record and fixed read-only endpoint', async () => {
  const credentials = store(), network = mock();
  const module = createBalance({ credentials, fetchImpl: network.fetchImpl, now: () => 123 });
  assert.deepEqual(await module.state(), { connected: false });
  const state = await module.connect('  sk-secret  ');
  assert.deepEqual(state, { connected: true, source: { kind: 'manual' }, balance: { available: 12.5, currency: 'USD' }, updatedAt: 123 });
  assert.equal(credentials.writes, 1);
  assert.equal(network.calls[0].url, USAGE_URL);
  assert.equal(network.calls[0].options.method, 'GET');
  assert.equal(network.calls[0].options.redirect, 'error');
  assert.equal(network.calls[0].options.headers.Authorization, 'Bearer sk-secret');
  assert.ok(credentials.reads.every(k => k === CREDENTIAL_KEY));
  assert.ok(!JSON.stringify(state).includes('sk-secret'));
  await module.disconnect(); assert.deepEqual(await module.state(), { connected: false });
});
test('zero balance, currency fallbacks and finite validation', async () => {
  for (const [data, currency] of [[{ balance: 0 }, 'USD'], [{ balance: 0, unit: 'CNY' }, 'CNY']]) {
    const m = createBalance({ credentials: store(), ...mock(data) });
    assert.equal((await m.connect('sk-test')).balance.currency, currency);
    assert.equal((await m.state()).balance.available, 0);
  }
  for (const data of [{}, { balance: '0' }, { data: { balance: 1 } }, { balance: 1, isValid: false }, { balance: 1, is_active: false }, { balance: 2, currency: '<script>' }]) {
    const credentials = store(), m = createBalance({ credentials, ...mock(data) });
    await assert.rejects(m.connect('sk-test')); assert.equal(credentials.writes, 0);
  }
});
test('failure messages never echo upstream credentials or raw body', async () => {
  const credentials = store();
  const m = createBalance({ credentials, fetchImpl: async () => new Response('sk-supersecret', { status: 401 }) });
  const response = await createResource(m, 'connect')(post({ apiKey: 'sk-supersecret' }), owner);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { connected: false, error: 'api_key_rejected' });
  assert.equal(credentials.writes, 0);
});
test('owner, method, exact Origin, JSON type, fields and body size enforcement', async () => {
  const credentials = store(), net = mock(), m = createBalance({ credentials, ...net });
  const route = createResource(m, 'connect');
  assert.equal((await route(post({ apiKey: 'sk-test' }))).status, 403);
  assert.equal((await route(post({}, { origin: 'https://evil.invalid' }), owner)).status, 403);
  assert.equal((await route(post({}, { origin: '' }), owner)).status, 403);
  assert.equal((await route(post({}, { 'content-type': 'text/plain' }), owner)).status, 415);
  assert.equal((await route(post({ other: 1 }), owner)).status, 400);
  assert.equal((await route(post({ apiKey: 'x'.repeat(3000) }), owner)).status, 413);
  assert.equal((await route(new Request('http://localhost:62763/x'), owner)).status, 405);
  assert.equal(net.calls.length, 0);
  const state = createResource(m, 'state');
  assert.equal((await state(post(), owner)).status, 405);
  const r = await state(new Request('http://localhost:62763/x'), owner);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { connected: false });
});
test('reject oversized, HTML, transport/redirect failures without saving', async () => {
  for (const response of [new Response('x'.repeat(65537)), new Response('<html>login</html>')]) {
    const credentials = store(), m = createBalance({ credentials, fetchImpl: async () => response });
    await assert.rejects(m.connect('sk-test')); assert.equal(credentials.writes, 0);
  }
  const credentials = store(), m = createBalance({ credentials, fetchImpl: async (_url, options) => { assert.equal(options.redirect, 'error'); throw Error('secret redirect'); } });
  await assert.rejects(m.connect('sk-test'), /upstream_network_error/);
  assert.equal(credentials.writes, 0);
});
test('refresh failure retains last balance and rejected replacement preserves prior credentials', async () => {
  const credentials = store(); let fail = false;
  const m = createBalance({ credentials, now: () => 77, fetchImpl: async () => fail ? new Response('private upstream detail', { status: 500 }) : Response.json({ balance: 8, currency: 'USD' }) });
  await m.connect('sk-original'); fail = true;
  await assert.rejects(m.refresh(), /upstream_request_failed/);
  assert.deepEqual(await m.state(), { connected: true, source: { kind: 'manual' }, balance: { available: 8, currency: 'USD' }, updatedAt: 77, error: 'upstream_request_failed' });
  await assert.rejects(m.connect('sk-replacement'), /upstream_request_failed/);
  assert.equal((await credentials.readRecord(CREDENTIAL_KEY)).key, 'sk-original');
  assert.equal(credentials.writes, 1);
});
test('refresh coalesces concurrent and short-window reads, expires, and retries after failure', async () => {
  let count = 0, active = 0, max = 0, clock = 100, fail = false;
  const credentials = store();
  const m = createBalance({ credentials, fetchImpl: async () => { active++; max = Math.max(max, active); await Promise.resolve(); active--; count++; return fail ? new Response('error', { status: 500 }) : Response.json({ balance: count }); }, now: () => clock, refreshWindowMs: 5000 });
  await m.connect('sk-test'); await Promise.all([m.refresh(), m.refresh()]);
  assert.equal(max, 1); assert.equal(count, 2); assert.equal((await m.state()).balance.available, 2);
  await m.refresh(); assert.equal(count, 2);
  clock += 5000; await m.refresh(); assert.equal(count, 3);
  clock += 5000; fail = true; await assert.rejects(m.refresh(), /upstream_request_failed/);
  fail = false; await m.refresh(); assert.equal(count, 5);
});
test('queued refresh re-reads a newly connected key before upstream request', async () => {
  const credentials = store(), keys = [];
  const m = createBalance({ credentials, fetchImpl: async (_url, options) => { keys.push(options.headers.Authorization); return Response.json({ balance: keys.length }); } });
  await m.connect('sk-old');
  const replacement = m.connect('sk-new');
  const refresh = m.refresh();
  await Promise.all([replacement, refresh]);
  assert.deepEqual(keys, ['Bearer sk-old', 'Bearer sk-new', 'Bearer sk-new']);
});


test('timeout, disposal and disconnect abort in-flight reads and cannot save key', async () => {
  for (const mode of ['timeout', 'dispose', 'disconnect']) {
    const credentials = store(); let began;
    const started = new Promise(resolve => { began = resolve; });
    const m = createBalance({ credentials, timeoutMs: 10, fetchImpl: async (_url, { signal }) => { began(); return new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(Error('abort')), { once: true }); }); } });
    const attempt = m.connect('sk-test');
    const rejected = assert.rejects(attempt, mode === 'timeout' ? /upstream_timeout/ : /operation_cancelled/);
    await started;
    let disconnect;
    if (mode === 'dispose') m.dispose();
    if (mode === 'disconnect') disconnect = m.disconnect();
    await rejected; if (disconnect) await disconnect;
    assert.equal(credentials.writes, 0); assert.equal((await m.state()).connected, false);
  }
});
test('HTTP handler admits browser identity and accepts POST through the actual carrier', async () => {
  const registered = [], cleanup = [], listeners = new Map();
  const server = createServer((req, res) => {
    const route = registered.find(r => r.path === req.url);
    if (!route) { res.writeHead(404); res.end(); return; }
    route.handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const connection = { admit({ headers }) {
    // Model the installed Connection fence: absent Origin is accepted; an
    // attached HTTP(S) Origin must match Host, independently of listener scheme.
    if (headers['sec-fetch-site'] === 'cross-site') return { rejection: 403 };
    if (headers.origin !== undefined) {
      try { const u = new URL(headers.origin); if (!['http:', 'https:'].includes(u.protocol) || u.host !== headers.host) return { rejection: 403 }; }
      catch { return { rejection: 403 }; }
    }
    return headers.cookie === 'test-session' ? { peer: owner } : { rejection: 401 };
  } };
  let savedConfig = { usdCnyRate: 7, unrelated: 'preserved' };
  apply({ credentials: store(), connection, on(name, handler) { listeners.set(name, handler); return () => listeners.delete(name); }, fiber: { entry: 'rate-test' }, configEditor: { async edit(entry, mutate) { assert.equal(entry, 'rate-test'); savedConfig = mutate(savedConfig); } }, effect(fn) { cleanup.push(fn()); }, webServer: { getOrigin: () => origin, register(route) { registered.push(route); return () => {}; } } }, { usdCnyRate: { get: () => savedConfig.usdCnyRate } });
  try {
    const denied = await fetch(origin + '/api/local-beeapi/state');
    assert.equal(denied.status, 401);
    assert.deepEqual(await denied.json(), { error: 'browser_auth_required' });
    const auth = { cookie: 'test-session', origin, 'content-type': 'application/json' };
    const state = await fetch(origin + '/api/local-beeapi/state', { headers: auth });
    assert.deepEqual(await state.json(), { connected: false, usdCnyRate: 7 });
    // Empty key returns business JSON, proving POST is no longer rejected by a GET-only resource carrier.
    const connect = await fetch(origin + '/api/local-beeapi/connect', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(connect.status, 400);
    assert.equal((await connect.json()).error, 'api_key_required');
    for (const originHeaders of [{}, { origin: origin.replace('http:', 'https:') }]) {
      const result = await fetch(origin + '/api/local-beeapi/connect', { method: 'POST', headers: { cookie: 'test-session', 'content-type': 'application/json', ...originHeaders }, body: '{}' });
      assert.equal(result.status, 400);
      assert.equal((await result.json()).error, 'api_key_required');
    }
    for (const bad of [{ origin: 'null' }, { 'sec-fetch-site': 'cross-site' }]) {
      const result = await fetch(origin + '/api/local-beeapi/connect', { method: 'POST', headers: { ...auth, ...bad }, body: '{}' });
      assert.equal(result.status, 403);
      assert.equal((await result.json()).error, 'browser_auth_required');
    }
    const cross = await fetch(origin + '/api/local-beeapi/connect', { method: 'POST', headers: { ...auth, origin: 'https://evil.invalid' }, body: '{}' });
    assert.equal(cross.status, 403);
    const large = await fetch(origin + '/api/local-beeapi/connect', { method: 'POST', headers: auth, body: JSON.stringify({ apiKey: 'x'.repeat(3000) }) });
    assert.equal(large.status, 413);
    const disconnect = await fetch(origin + '/api/local-beeapi/disconnect', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(disconnect.status, 200);
    assert.deepEqual(await disconnect.json(), { connected: false, usdCnyRate: 7 });
    const rateUrl = origin + '/api/local-beeapi/rate';
    const postRate = (body, headers = auth) => fetch(rateUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal((await postRate({ usdCnyRate: 8 }, { 'content-type': 'application/json' })).status, 401);
    assert.equal((await postRate({ usdCnyRate: 8 }, { ...auth, origin: 'https://evil.invalid' })).status, 403);
    assert.equal((await postRate({ usdCnyRate: 0 })).status, 400);
    assert.equal((await postRate({ usdCnyRate: 8, extra: 1 })).status, 400);
    assert.equal((await postRate({ usdCnyRate: 8, padding: 'x'.repeat(3000) })).status, 413);
    const saved = await postRate({ usdCnyRate: 7.2 });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { connected: false, usdCnyRate: 7.2 });
    assert.deepEqual(savedConfig, { usdCnyRate: 7.2, unrelated: 'preserved' });
    const reread = await fetch(origin + '/api/local-beeapi/state', { headers: auth });
    assert.deepEqual(await reread.json(), { connected: false, usdCnyRate: 7.2 });
  } finally {
    for (const dispose of cleanup.reverse()) dispose();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('post-commit completed turns refresh once; other turns and cleanup do not', async () => {
  const credentials = store(), network = mock();
  const connected = createBalance({ credentials, fetchImpl: network.fetchImpl });
  await connected.connect('sk-test');
  const handlers = new Map(), cleanup = [];
  // The event handler owns the same persisted credential record as this fixture.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = network.fetchImpl;
  try {
    apply({ credentials, on(name, listener) { handlers.set(name, listener); return () => handlers.delete(name); }, effect(fn) { cleanup.push(fn()); }, webServer: { register() { return () => {}; } } });
    const emit = (kind, origin) => handlers.get('session/event')({ header: { origin } }, { type: 'turn/end', data: { reason: { kind } } });
    emit('aborted'); emit('error'); emit('completed', 'subagent');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(network.calls.length, 1);
    emit('completed'); emit('completed');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(network.calls.length, 2);
    emit('completed');
    for (const dispose of cleanup.reverse()) dispose();
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(network.calls.length, 2);
    assert.equal(handlers.size, 0);
  } finally { globalThis.fetch = originalFetch; }
});


test('host installs exact resource routes and scoped cleanup', () => {
  const registered = [], cleanup = [], listeners = new Map();
  apply({ credentials: store(), on(name, handler) { listeners.set(name, handler); return () => listeners.delete(name); }, effect(fn) { cleanup.push(fn()); }, webServer: { register(route) { registered.push(route); return () => registered.splice(registered.indexOf(route), 1); } } });
  assert.deepEqual(registered.map(r => r.path), ['state','connect','refresh','disconnect','rate'].map(a => `/api/local-beeapi/${a}`));
  assert.ok(registered.every(r => r.kind === 'exact' && typeof r.handler === 'function'));
  for (const dispose of cleanup.reverse()) dispose(); assert.equal(registered.length, 0);
});
