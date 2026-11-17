export const DEFAULT_USD_CNY_RATE = 7;
export function validRate(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000; }
export function createRate({ config, editor, entry }) {
  const get = () => {
    const field = config?.usdCnyRate;
    const value = field && typeof field.get === 'function' ? field.get() : field;
    return validRate(value) ? value : DEFAULT_USD_CNY_RATE;
  };
  return {
    get,
    async save(value) {
      if (!validRate(value)) throw new Error('invalid_exchange_rate');
      if (entry === undefined || !editor) throw new Error('rate_save_failed');
      await editor.edit(entry, current => ({ ...current, usdCnyRate: value }));
      if (get() !== value) throw new Error('rate_save_failed');
      return value;
    }
  };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function createRateResource(balance, rate) {
  return async (request, peer) => {
    if (peer?.principal?.kind !== 'owner') return json({ error: 'owner_required' }, 403);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'usdCnyRate') || !validRate(body.usdCnyRate)) return json({ error: 'invalid_exchange_rate' }, 400);
    try { await rate.save(body.usdCnyRate); }
    catch { return json({ error: 'rate_save_failed' }, 500); }
    try { return json({ ...await balance.state(), usdCnyRate: rate.get() }); }
    catch { return json({ error: 'credential_or_internal_error' }, 500); }
  };
}
export async function withRate(response, rate) {
  if (!response.ok) return response;
  const data = await response.json();
  return new Response(JSON.stringify({ ...data, usdCnyRate: rate.get() }), { status: response.status, headers: response.headers });
}
