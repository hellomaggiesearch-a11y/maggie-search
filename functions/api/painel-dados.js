// GET /api/painel-dados — private dashboard data (last 30 days + subscribers).
// Password lives in the Cloudflare secret PAINEL_PASSWORD (never in the repo).
import { ensureSchema, londonDay, sha256Hex, json } from '../../lib/painel.js';

async function authOk(request, env) {
  const given = request.headers.get('authorization') || '';
  if (!given || !env.PAINEL_PASSWORD) return false;
  // compare digests so the check takes the same time for any input
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(env.PAINEL_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function lastDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(londonDay(new Date(Date.now() - i * 864e5)));
  return out; // newest first
}

const pairs = (rows, key) => rows.map((r) => [r[key], r.c]);

export async function onRequestGet({ request, env }) {
  if (!(await authOk(request, env))) return json({ error: 'Not authorized.' }, { status: 401 });

  await ensureSchema(env.DB);
  const days = lastDays(30);
  const since = days[days.length - 1];

  const [perDay, paths, refs, searches, subs] = await env.DB.batch([
    env.DB.prepare(`SELECT day, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS v
                    FROM pageviews WHERE day >= ? GROUP BY day`).bind(since),
    env.DB.prepare(`SELECT path, COUNT(*) AS c FROM pageviews WHERE day >= ? AND path IS NOT NULL
                    GROUP BY path ORDER BY c DESC LIMIT 12`).bind(since),
    env.DB.prepare(`SELECT ref, COUNT(*) AS c FROM pageviews WHERE day >= ?
                    GROUP BY ref ORDER BY c DESC LIMIT 10`).bind(since),
    env.DB.prepare(`SELECT term, COUNT(*) AS c FROM searches WHERE day >= ?
                    GROUP BY term ORDER BY c DESC LIMIT 15`).bind(since),
    env.DB.prepare(`SELECT email, produto, termo, preco_na_inscricao, created_at
                    FROM subscribers ORDER BY created_at DESC`),
  ]);

  const byDay = new Map(perDay.results.map((r) => [r.day, r]));
  return json({
    days: days.reverse().map((d) => ({
      date: d,
      pageviews: byDay.get(d)?.pv || 0,
      visitors: byDay.get(d)?.v || 0,
    })),
    topPaths: pairs(paths.results, 'path'),
    topSearches: pairs(searches.results, 'term'),
    topRefs: pairs(refs.results, 'ref'),
    subscribers: subs.results,
    generated_at: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, { status: 405 });
}
