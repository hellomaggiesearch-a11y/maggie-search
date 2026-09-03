import { getStore } from '@netlify/blobs';
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { topN } from './_aggregate.mjs';

// Password check via a committed PBKDF2-SHA256 hash — no Netlify env var needed.
// The hash reveals nothing without the (long, random) password.
const PWD_SALT = '7e5d3db38025eeccbf401839cb1a337e';
const PWD_ITER = 150000;
const PWD_HASH = 'b23da1fadaf371c5f99e2218454b06070115203864e5381757ff11f2ddb787af';

function authOk(req) {
  const given = req.headers.get('authorization') || '';
  if (!given) return false;
  let h;
  try { h = pbkdf2Sync(given, PWD_SALT, PWD_ITER, 32, 'sha256').toString('hex'); }
  catch { return false; }
  const a = Buffer.from(h);
  const b = Buffer.from(PWD_HASH);
  return a.length === b.length && timingSafeEqual(a, b);
}

function lastDays(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }));
  }
  return out;
}

async function fetchSubscribers(store) {
  const out = [];
  try {
    const { blobs } = await store.list({ prefix: 'sub:' });
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: 'json' });
      if (rec) out.push(rec);
    }
  } catch { /* empty */ }
  out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return out;
}

export default async (req) => {
  if (!authOk(req)) return Response.json({ error: 'Not authorized.' }, { status: 401 });

  const store = getStore('painel');
  const days = lastDays(30);
  const perDay = [];
  const paths = {};
  const referrers = {};
  const searches = {};

  for (const day of days) {
    const t = await store.get(`traffic:${day}`, { type: 'json' });
    if (t) {
      perDay.push({ date: day, pageviews: t.pageviews || 0, visitors: (t.visitors || []).length });
      for (const [k, v] of Object.entries(t.paths || {})) paths[k] = (paths[k] || 0) + v;
      for (const [k, v] of Object.entries(t.referrers || {})) referrers[k] = (referrers[k] || 0) + v;
    } else {
      perDay.push({ date: day, pageviews: 0, visitors: 0 });
    }
    const s = await store.get(`searches:${day}`, { type: 'json' });
    if (s) for (const [k, v] of Object.entries(s)) searches[k] = (searches[k] || 0) + v;
  }

  const subscribers = await fetchSubscribers(store);

  return Response.json({
    days: perDay.reverse(),
    topPaths: topN(paths, 12),
    topSearches: topN(searches, 15),
    topRefs: topN(referrers, 10),
    subscribers,
    generated_at: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
};
