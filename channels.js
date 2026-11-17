// Host-only channel resolution. Never return settings values or secrets to the browser.
export class ChannelError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function isBeeApiUrl(value) {
  if (typeof value !== 'string') return false;
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'beeapi.dev' && !u.username && !u.password && !u.port; }
  catch { return false; }
}
const getPath = (value, path) => path.reduce((v, key) => v && typeof v === 'object' ? v[key] : undefined, value);
const idFor = (kind, ns, route) => `${kind}:${encodeURIComponent(ns)}:${encodeURIComponent(route)}`;
const keyPresent = value => typeof value === 'string' && value.trim().length > 0;
export function createChannels({ settings, llm, credentials, configEditor }) {
  function entries(redactSecrets) {
    const descriptors = settings?.describe({ redactSecrets }) ?? [];
    const out = [];
    for (const p of llm?.listConfigurableProviders() ?? []) {
      const d = descriptors.find(d => d.ns === p.settingsNs);
      const v = getPath(d?.value, p.settingsPath);
      const endpoint = v?.baseURL ?? p.defaultBaseURL;
      if (!isBeeApiUrl(endpoint) || !keyPresent(v?.apiKeyEnv)) continue;
      const ref = v.apiKeyEnv;
      out.push({ id: idFor('chat', p.settingsNs, p.provider), kind: 'chat', label: p.displayName || p.provider, ns: p.settingsNs, route: p.provider, endpoint, ref });
    }
    const imageEntries = (configEditor?.entries() ?? []).filter(e => !e.disabled && e.options?.name === '@dickpy/dsh-imagegen');
    const imageNamespaces = new Set(imageEntries.flatMap(e => [e.id, e.options.id]));
    if (imageEntries.length === 1) imageNamespaces.add('dsh-imagegen');
    for (const d of descriptors) {
      if (!imageNamespaces.has(d.ns)) continue;
      const v = d.value;
      for (const c of Array.isArray(v?.channels) ? v.channels : []) {
        if (c.auth === 'subscription' || !keyPresent(c.id) || !isBeeApiUrl(c.apiUrl)) continue;
        const configured = redactSecrets
          ? Boolean(d.secrets?.some(s => s.set && s.path.length === 2 && s.path[0] === 'channelSecrets' && s.path[1] === c.id))
          : keyPresent(v.channelSecrets?.[c.id]);
        out.push({ id: idFor('image', d.ns, c.id), kind: 'image', label: c.name || c.id, ns: d.ns, route: c.id, endpoint: c.apiUrl, configured, ...(redactSecrets ? {} : { key: v.channelSecrets?.[c.id] }) });
      }
    }
    return out;
  }
  return {
    async list() {
      const out = [];
      for (const e of entries(true)) {
        let configured = e.configured;
        if (e.kind === 'chat') configured = Boolean((await credentials.describe(e.ref)).configured);
        out.push({ id: e.id, label: e.label, kind: e.kind, configured: Boolean(configured) });
      }
      return out;
    },
    async resolve(id, previous) {
      const entry = entries(false).find(e => e.id === id);
      if (!entry) throw new ChannelError('channel_unavailable');
      const binding = { type: 'beeapi-channel-v1', id: entry.id, kind: entry.kind, ns: entry.ns, route: entry.route, endpoint: entry.endpoint, ...(entry.ref ? { ref: entry.ref } : {}) };
      if (previous && (previous.endpoint !== binding.endpoint || previous.ref !== binding.ref || previous.kind !== binding.kind || previous.ns !== binding.ns || previous.route !== binding.route)) throw new ChannelError('channel_changed');
      const key = entry.kind === 'chat' ? (await credentials.resolve(entry.ref))?.value : entry.key;
      if (!keyPresent(key)) throw new ChannelError('channel_key_missing');
      return { key, binding, source: { id: entry.id, label: entry.label, kind: entry.kind } };
    }
  };
}
