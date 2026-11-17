import z from '@deepseek-ai/schemastery';
import { createRate, createRateResource, withRate } from './rate.js';
import { createBalance, createResource } from './oauth.js';
import { createChannels } from './channels.js';

export const inject = ['credentials', 'webServer', 'connection', 'settings', 'llm', 'configEditor'];
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const Config = z.object({ usdCnyRate: z.number().min(Number.MIN_VALUE).max(10000).default(7).volatile() });
export function apply(ctx, config) {
  const channels = ctx.settings ? createChannels({ settings: ctx.settings, llm: ctx.llm, credentials: ctx.credentials, configEditor: ctx.configEditor }) : undefined;
  const balance = createBalance({ credentials: ctx.credentials, channels });
  const rate = createRate({ config, editor: ctx.configEditor, entry: ctx.fiber?.entry });
  ctx.effect(() => () => balance.dispose());
  let pendingTurnRefresh;
  ctx.effect(() => {
    const remove = ctx.on('session/event', (session, event) => {
      if (event.type !== 'turn/end' || event.data?.reason?.kind !== 'completed' || session.header?.origin === 'subagent') return;
      clearTimeout(pendingTurnRefresh);
      pendingTurnRefresh = setTimeout(() => {
        pendingTurnRefresh = undefined;
        void balance.connected().then(connected => connected && balance.refresh()).catch(() => {});
      }, 300);
    });
    return () => { clearTimeout(pendingTurnRefresh); remove(); };
  });
  for (const action of ['state', 'connect', 'refresh', 'disconnect', 'rate']) {
    const resource = action === 'rate' ? createRateResource(balance, rate) : createResource(balance, action, { originAdmitted: true });
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: `/api/local-beeapi/${action}`,
      async handler(req, res) {
        const reply = (status, error) => { res.writeHead(status, headers); res.end(JSON.stringify({ error })); };
        try {
          const admission = ctx.connection.admit({ headers: req.headers });
          if ('rejection' in admission) { reply(admission.rejection, 'browser_auth_required'); return; }
          const method = req.method || 'GET';
          if (method !== (action === 'state' ? 'GET' : 'POST')) { reply(405, 'method_not_allowed'); return; }
          // admit() is the authoritative Host/Origin and credential fence.
          // It accepts absent Origin and HTTPS proxy origins; do not compare
          // those against the internal listener URL again.
          const url = new URL(`/api/local-beeapi/${action}`, ctx.webServer.getOrigin());
          const requestHeaders = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            for (const item of typeof value === 'string' ? [value] : value || []) requestHeaders.append(name, item);
          }
          let body;
          if (method === 'POST') {
            if (requestHeaders.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') { reply(415, 'json_required'); return; }
            const length = requestHeaders.get('content-length');
            if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2048)) { reply(413, 'body_too_large'); return; }
            const chunks = []; let size = 0;
            req.setTimeout(10000, () => req.destroy());
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 2048) { reply(413, 'body_too_large'); return; }
              chunks.push(Buffer.from(chunk));
            }
            req.setTimeout(0);
            body = Buffer.concat(chunks);
          }
          const response = await withRate(await resource(new Request(url, { method, headers: requestHeaders, ...(body === undefined ? {} : { body }) }), admission.peer), rate);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch {
          if (!res.headersSent) reply(500, 'credential_or_internal_error');
          else res.end();
        }
      }
    }));
  }
}
