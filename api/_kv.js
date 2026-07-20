// Thin wrapper over the Upstash Redis REST API.
// Every domain module (customers.js, products.js, ...) reads/writes through
// kvGet/kvSet instead of touching Redis directly. kvSet enforces a whitelist
// of known data-domain keys so a typo or a rogue write can't clobber an
// arbitrary key. Add new domains to WRITABLE_KEYS as they're introduced.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const WRITABLE_KEYS = new Set([
  'users',
  'customers',
  'products',
  'quotes',
  'payments',
  'activity',
  'settings',
  'suppliers',
  'shipments',
  'tasks',
  'expenses',
  'claims',
]);

async function kvCommand(command) {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV not configured: set KV_REST_API_URL and KV_REST_API_TOKEN');
  }
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function kvGet(key) {
  const result = await kvCommand(['GET', key]);
  if (result === null || result === undefined) return null;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

async function kvSet(key, value) {
  if (!WRITABLE_KEYS.has(key)) {
    throw new Error(`Key "${key}" is not in the writable key whitelist`);
  }
  await kvCommand(['SET', key, JSON.stringify(value)]);
  return true;
}

module.exports = { kvGet, kvSet, WRITABLE_KEYS };
