import test from 'node:test';
import assert from 'node:assert/strict';
import { createChannels, isBeeApiUrl } from './channels.js';
import { createBalance, createResource, CREDENTIAL_KEY } from './oauth.js';
function fixture() {
  let record; let secret = 'sk-first';
  const profile = { baseURL: 'https://beeapi.dev/v1', apiKeyEnv: 'BEE_KEY' };
  const image = { channels: [{ id: 'bee', name: 'Bee image', apiUrl: 'https://beeapi.dev/v1', auth: 'api-key' }], channelSecrets: { bee: 'sk-image' } };
  const settings = { describe({ redactSecrets }) { return [ { ns: 'chat', value: { providers: { bee: profile } } }, { ns: 'include:imagegen', value: { ...image, channelSecrets: redactSecrets ? {} : image.channelSecrets }, secrets: [{ path: ['channelSecrets', 'bee'], set: Boolean(image.channelSecrets.bee) }] } ]; } };
  const credentials = { async describe() { return { configured: Boolean(secret) }; }, async resolve() { return secret ? { value: secret } : undefined; }, async readRecord(key) { assert.equal(key, CREDENTIAL_KEY); return record; }, async modifyRecord(key, fn) { assert.equal(key, CREDENTIAL_KEY); record = await fn(record); return record; }, async deleteRecord(key) { assert.equal(key, CREDENTIAL_KEY); record = undefined; } };
  const llm = { listConfigurableProviders() { return [{ provider: 'bee', displayName: 'Bee chat', settingsNs: 'chat', settingsPath: ['providers', 'bee'] }]; } };
  const configEditor = { entries() { return [{ id: 'include:imagegen', options: { name: '@dickpy/dsh-imagegen' } }]; } };
  const channels = createChannels({ settings, llm, credentials, configEditor });
  const calls = []; let fail = false;
  const balance = createBalance({ credentials, channels, fetchImpl: async (_url, options) => { calls.push(options.headers.Authorization); return fail ? new Response('', { status: 401 }) : Response.json({ balance: 12 }); } });
  return { profile, image, channels, balance, credentials, calls, setKey(value) { secret = value; }, fail() { fail = true; } };
}
test('only exact secure BeeAPI endpoints and safe metadata are listed', async () => {
  for (const url of ['http://beeapi.dev/v1', 'https://beeapi.dev.evil/v1', 'https://user@beeapi.dev/v1', 'https://beeapi.dev:444/v1', 'https://beeapi.ai/v1']) assert.equal(isBeeApiUrl(url), false);
  assert.equal(isBeeApiUrl('https://beeapi.dev:443/v1'), true);
  const f = fixture(), list = await f.channels.list();
  assert.equal(list.length, 2); assert.ok(list.every(c => c.configured));
  assert.deepEqual(Object.keys(list[0]).sort(), ['configured','id','kind','label']);
  assert.ok(!JSON.stringify(list).includes('sk-'));
  f.profile.baseURL = 'https://evil.invalid'; assert.equal((await f.channels.list()).length, 1);
  f.image.channels[0].auth = 'subscription'; assert.equal((await f.channels.list()).length, 0);
});
test('chat binding stores only reference, rotates key and disconnects only own record', async () => {
  const f = fixture(), c = (await f.channels.list())[0];
  const state = await f.balance.connectChannel(c.id);
  assert.equal(state.source.kind, 'chat'); assert.equal(state.channels.length, 2);
  assert.ok(!JSON.stringify(await f.credentials.readRecord(CREDENTIAL_KEY)).includes('sk-'));
  f.setKey('sk-rotated'); await f.balance.refresh(); assert.deepEqual(f.calls, ['Bearer sk-first', 'Bearer sk-rotated']);
  await f.balance.disconnect(); assert.equal((await f.channels.list())[0].configured, true);
  assert.equal((await f.balance.state()).connected, false);
});
test('image binding refresh uses current secret and never copies it', async () => {
  const f = fixture(), c = (await f.channels.list()).find(c => c.kind === 'image');
  await f.balance.connectChannel(c.id); f.image.channelSecrets.bee = 'sk-image-rotated'; await f.balance.refresh();
  assert.deepEqual(f.calls, ['Bearer sk-image', 'Bearer sk-image-rotated']);
  assert.ok(!JSON.stringify(await f.credentials.readRecord(CREDENTIAL_KEY)).includes('sk-'));
  delete f.image.channelSecrets.bee;
  await assert.rejects(f.balance.refresh(), /channel_key_missing/);
});
test('removed, changed or unavailable channel fails without silently switching', async () => {
  for (const mode of ['deleted', 'url', 'ref', 'missing']) {
    const f = fixture(), id = (await f.channels.list())[0].id; await f.balance.connectChannel(id);
    if (mode === 'deleted') f.profile.baseURL = 'https://other.invalid/v1';
    if (mode === 'url') f.profile.baseURL = 'https://beeapi.dev/other';
    if (mode === 'ref') f.profile.apiKeyEnv = 'OTHER_KEY';
    if (mode === 'missing') f.setKey('');
    await assert.rejects(f.balance.refresh(), mode === 'deleted' ? /channel_unavailable/ : mode === 'missing' ? /channel_key_missing/ : /channel_changed/);
    assert.equal(f.calls.length, 1);
    assert.equal((await f.balance.state()).balance.available, 12);
  }
});
test('failed binding preserves old manual record; state does not query upstream; fields exclusive', async () => {
  const f = fixture(); await f.balance.connect('sk-manual'); const old = await f.credentials.readRecord(CREDENTIAL_KEY);
  f.fail(); await assert.rejects(f.balance.connectChannel((await f.channels.list())[0].id), /api_key_rejected/);
  assert.deepEqual(await f.credentials.readRecord(CREDENTIAL_KEY), old);
  const count = f.calls.length; await f.balance.state(); assert.equal(f.calls.length, count);
  const request = new Request('http://localhost/x', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: 'x', channelId: 'x' }) });
  const response = await createResource(f.balance, 'connect')(request, { principal: { kind: 'owner' } });
  assert.equal(response.status, 400); assert.equal((await response.json()).error, 'unexpected_field');
});
