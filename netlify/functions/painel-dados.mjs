import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';
import { topN } from './_aggregate.mjs';

function authOk(req) {
  const pwd = process.env.PAINEL_PASSWORD;
  if (!pwd) return false;
  const given = req.headers.get('authorization') || '';
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(pwd));
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
