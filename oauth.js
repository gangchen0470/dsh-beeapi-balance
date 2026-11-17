import { createHash } from 'node:crypto';
import { ChannelError } from './channels.js';
// Historical filename; this module uses only the official read-only API-key usage endpoint.
export const USAGE_URL = 'https://beeapi.dev/v1/usage';
export const CREDENTIAL_KEY = 'beeapi-dashboard/balance-api-key-v1';
class SafeError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function storedKey(record) { return record?.kind === 'api-key' && typeof record.key === 'string' && record.key ? record.key : undefined; }
function validateKey(value) {
  if (typeof value !== 'string' || !value.trim()) throw new SafeError('api_key_required');
  const key = value.trim();
  if (key.length > 512 || !/^[\x21-\x7e]+$/.test(key)) throw new SafeError('invalid_api_key');
  return key;
}
export function createBalance({ credentials, channels, fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 12000, refreshWindowMs = 5000 }) {
  let balance, updatedAt, error, disposed = false, epoch = 0;
  let refreshTask;
  let queue = Promise.resolve();
  const controllers = new Set();
  const serial = fn => { const task = queue.then(fn); queue = task.catch(() => {}); return task; };
  const check = version => { if (disposed || version !== epoch) throw new SafeError('operation_cancelled', 409); };
  function abort() { epoch++; for (const c of controllers) c.abort(); }
  async function query(key, version) {
    check(version);
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(USAGE_URL, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${key}` }, redirect: 'error', signal: controller.signal });
      check(version);
      if (!response.ok) {
        await response.body?.cancel();
        throw new SafeError(response.status === 401 || response.status === 403 ? 'api_key_rejected' : 'upstream_request_failed', response.status >= 500 ? 503 : 400);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new SafeError('invalid_usage_response', 502);
      let size = 0; const chunks = [];
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) { await reader.cancel(); throw new SafeError('upstream_response_too_large', 502); } chunks.push(Buffer.from(value)); }
      } finally { reader.releaseLock(); }
      check(version);
      let json; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new SafeError('invalid_usage_response', 502); }
      if (!json || typeof json !== 'object' || Array.isArray(json) || !Number.isFinite(json.balance)) throw new SafeError('invalid_usage_response', 502);
      if (json.is_active === false || json.isValid === false) throw new SafeError('api_key_rejected');
      const currency = json.currency || json.unit || 'USD';
      if (typeof currency !== 'string' || !/^[A-Za-z]{3,10}$/.test(currency)) throw new SafeError('invalid_usage_response', 502);
      return { available: json.balance, currency };
    } catch (e) {
      check(version);
      if (e instanceof SafeError) throw e;
      throw new SafeError(controller.signal.aborted ? 'upstream_timeout' : 'upstream_network_error', 503);
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  async function state() {
    const record = await credentials.readRecord(CREDENTIAL_KEY);
    const binding = record?.kind === 'grant' && record.payload?.type === 'beeapi-channel-v1' ? record.payload : undefined;
    const connected = Boolean(storedKey(record) || binding);
    const directory = channels ? await channels.list() : undefined;
    const selected = binding && directory?.find(c => c.id === binding.id);
    const source = connected ? binding ? { id: binding.id, label: selected?.label || binding.route, kind: binding.kind } : { kind: 'manual' } : undefined;
    return { connected, ...(directory ? { channels: directory } : {}), ...(source ? { source } : {}), ...(connected && balance ? { balance, updatedAt } : {}), ...(error ? { error } : {}) };
  }
  function run(fn) {
    const version = epoch;
    return serial(async () => {
      try { check(version); error = undefined; await fn(version); check(version); return await state(); }
      catch (e) { if (version === epoch && !disposed) error = e instanceof SafeError || e instanceof ChannelError ? e.code : 'credential_or_internal_error'; throw e instanceof SafeError ? e : new SafeError(e instanceof ChannelError ? e.code : 'credential_or_internal_error', e instanceof ChannelError ? 400 : 500); }
    });
  }
  async function currentKey() {
    const record = await credentials.readRecord(CREDENTIAL_KEY);
    let key = storedKey(record);
    if (record?.kind === 'grant' && record.payload?.type === 'beeapi-channel-v1') {
      if (!channels) throw new SafeError('channel_unavailable');
      key = (await channels.resolve(record.payload.id, record.payload)).key;
    }
    if (!key) throw new SafeError('account_not_connected');
    return validateKey(key);
  }
  return {
    state,
    async connected() {
      const record = await credentials.readRecord(CREDENTIAL_KEY);
      return Boolean(storedKey(record) || (record?.kind === 'grant' && record.payload?.type === 'beeapi-channel-v1'));
    },
    connect(apiKey) { refreshTask = undefined; return run(async version => {
      const key = validateKey(apiKey);
      const next = await query(key, version);
      await credentials.modifyRecord(CREDENTIAL_KEY, async () => { check(version); return { kind: 'api-key', key }; });
      check(version); refreshTask = undefined; balance = next; updatedAt = now();
    }); },
    connectChannel(channelId) { refreshTask = undefined; return run(async version => {
      if (typeof channelId !== 'string' || !channelId || channelId.length > 2048 || !channels) throw new SafeError('channel_unavailable');
      const selected = await channels.resolve(channelId);
      const next = await query(validateKey(selected.key), version);
      await credentials.modifyRecord(CREDENTIAL_KEY, async () => { check(version); return { kind: 'grant', payload: selected.binding }; });
      check(version); refreshTask = undefined; balance = next; updatedAt = now();
    }); },
    async refresh() {
      let key;
      try { key = await currentKey(); } catch (e) {
        const code = e instanceof SafeError || e instanceof ChannelError ? e.code : 'credential_or_internal_error';
        error = code; refreshTask = undefined;
        throw e instanceof SafeError ? e : new SafeError(code, e instanceof ChannelError ? 400 : 500);
      }
      const fingerprint = createHash('sha256').update(key).digest('hex');
      if (refreshTask && refreshTask.epoch === epoch && refreshTask.fingerprint === fingerprint && (refreshTask.pending || now() - refreshTask.finishedAt < refreshWindowMs)) return refreshTask.promise;
      const task = { epoch, fingerprint, pending: true, finishedAt: 0, promise: undefined };
      task.promise = run(async version => {
        const latestKey = await currentKey();
        const next = await query(latestKey, version); check(version); balance = next; updatedAt = now();
      });
      refreshTask = task;
      task.promise.then(() => { task.pending = false; task.finishedAt = now(); }, () => { if (refreshTask === task) refreshTask = undefined; });
      return task.promise;
    },
    disconnect() {
      abort(); refreshTask = undefined;
      return run(async version => {
        check(version); await credentials.deleteRecord(CREDENTIAL_KEY); check(version); balance = undefined; updatedAt = undefined;
      });
    },
    dispose() { disposed = true; abort(); }
  };
}
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
async function readBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new SafeError('json_required', 415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2048)) throw new SafeError('body_too_large', 413);
  const reader = request.body?.getReader(); let size = 0; const chunks = [];
  if (reader) { try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2048) { await reader.cancel(); throw new SafeError('body_too_large', 413); } chunks.push(Buffer.from(value)); } } finally { reader.releaseLock(); } }
  let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new SafeError('invalid_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SafeError('invalid_json');
  return body;
}
export function createResource(balance, action, { originAdmitted = false } = {}) {
  return async (request, peer) => {
    if (peer?.principal?.kind !== 'owner') return jsonResponse({ error: 'owner_required' }, 403);
    try {
      if (action === 'state') {
        if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
        return jsonResponse(await balance.state());
      }
      if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
      if (!originAdmitted && request.headers.get('origin') !== new URL(request.url).origin) throw new SafeError('same_origin_required', 403);
      const body = await readBody(request);
      const allowed = action === 'connect' ? ['apiKey', 'channelId'] : [];
      if (Object.keys(body).some(k => !allowed.includes(k))) throw new SafeError('unexpected_field');
      if (action === 'connect') {
        if (Object.hasOwn(body, 'apiKey') && Object.hasOwn(body, 'channelId')) throw new SafeError('unexpected_field');
        return jsonResponse(await (Object.hasOwn(body, 'channelId') ? balance.connectChannel(body.channelId) : balance.connect(body.apiKey)));
      }
      return jsonResponse(await balance[action]());
    } catch (e) {
      const code = e instanceof SafeError ? e.code : 'credential_or_internal_error';
      return jsonResponse({ ...(await balance.state().catch(() => ({ connected: false }))), error: code }, e instanceof SafeError ? e.status : 500);
    }
  };
}
