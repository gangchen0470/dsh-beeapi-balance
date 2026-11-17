import test from 'node:test';
import assert from 'node:assert/strict';
import { createRate, createRateResource, validRate, withRate } from './rate.js';
const owner = { principal: { kind: 'owner' } };
const request = body => new Request('http://localhost/api/local-beeapi/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('default 7, finite positive bounds, persisted live configuration and no collateral config changes', async () => {
  assert.equal(createRate({}).get(), 7);
  for (const x of [0, -1, NaN, Infinity, '7', null, 10001]) assert.equal(validRate(x), false);
  assert.ok(validRate(0.00001)); assert.ok(validRate(10000));
  let current = { other: 'preserved' }, live = 7;
  const rate = createRate({ config: { usdCnyRate: { get: () => live } }, entry: 'my-entry', editor: { async edit(entry, mutate) { assert.equal(entry, 'my-entry'); current = mutate(current); live = current.usdCnyRate; } } });
  assert.equal(await rate.save(7.2), 7.2); assert.equal(rate.get(), 7.2);
  assert.deepEqual(current, { other: 'preserved', usdCnyRate: 7.2 });
  await assert.rejects(rate.save(0), /invalid_exchange_rate/);
});
test('save errors and ineffective persistence never report success', async () => {
  for (const editor of [undefined, { async edit() { throw Error('private path'); } }, { async edit() {} }]) {
    const r = createRate({ config: { usdCnyRate: 7 }, editor, entry: 'my-entry' });
    await assert.rejects(r.save(8)); assert.equal(r.get(), 7);
  }
});
test('rate resource checks owner, method, strict fields and reports safe errors', async () => {
  let value = 7, saves = 0;
  const rate = { get: () => value, async save(v) { saves++; value = v; } };
  const resource = createRateResource({ async state() { return { connected: false }; } }, rate);
  assert.equal((await resource(request({ usdCnyRate: 8 }))).status, 403);
  assert.equal((await resource(new Request('http://localhost'), owner)).status, 405);
  for (const body of [{}, [], { usdCnyRate: 0 }, { usdCnyRate: '7' }, { usdCnyRate: 8, extra: 1 }]) assert.equal((await resource(request(body), owner)).status, 400);
  assert.equal(saves, 0);
  assert.deepEqual(await (await resource(request({ usdCnyRate: 8 }), owner)).json(), { connected: false, usdCnyRate: 8 });
  const fail = createRateResource({}, { async save() { throw Error('private'); } });
  const response = await fail(request({ usdCnyRate: 8 }), owner);
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'rate_save_failed' });
});
test('response decoration changes only successful JSON and preserves headers', async () => {
  const response = await withRate(Response.json({ connected: true }, { headers: { 'Cache-Control': 'no-store' } }), { get: () => 7 });
  assert.deepEqual(await response.json(), { connected: true, usdCnyRate: 7 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const denied = Response.json({ error: 'owner_required' }, { status: 403 });
  assert.equal(await withRate(denied, { get: () => 7 }), denied);
});
