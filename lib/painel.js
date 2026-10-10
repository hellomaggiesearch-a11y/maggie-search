// Shared helpers for the Cloudflare Pages Functions in functions/api/.
// Storage: Cloudflare D1 (binding `DB`). Replaces Netlify Blobs.
// Tables are created on first use, so no SQL console step is needed.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pageviews (
     day TEXT NOT NULL, path TEXT, ref TEXT, visitor TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_pageviews_day ON pageviews(day)`,
  `CREATE TABLE IF NOT EXISTS searches (day TEXT NOT NULL, term TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_searches_day ON searches(day)`,
  `CREATE TABLE IF NOT EXISTS subscribers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT NOT NULL, produto TEXT, termo TEXT,
     preco_na_inscricao REAL, created_at TEXT NOT NULL)`,
];

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

export function londonDay(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeRefHost(referrer, selfHost) {
  if (!referrer) return 'direct';
  let host;
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'direct'; }
  if (!host || host === selfHost || host === `www.${selfHost}`) return 'direct';
  if (host.includes('google.')) return 'google';
  if (host.includes('bing.')) return 'bing';
  return host;
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || '0';
}

export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
