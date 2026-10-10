// GET /api/painel-dados — private dashboard data (last 30 days + subscribers).
// Password lives in the Cloudflare secret PAINEL_PASSWORD (never in the repo).
import { ensureSchema, londonDay, sha256Hex, json } from '../../lib/painel.js';

async function authOk(request, env) {
  // trim: the dashboard's secret field is a textarea, a stray Enter must not lock you out
  const given = (request.headers.get('authorization') || '').trim();
  const expected = String(env.PAINEL_PASSWORD || '').trim();
  if (!given || !expected) return false;
  // compare digests so the check takes the same time for any input
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
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
  if (!env.DB) return json({ error: 'Database binding DB is missing.' }, { status: 500 });
  try {
    return await buildReport(env);
  } catch (e) {
    return json({ error: 'Database error: ' + (e && e.message ? e.message : String(e)) }, { status: 500 });
  }
}

async function buildReport(env) {
  await ensureSchema(env.DB);
  // privacy policy retention, enforced whenever the dashboard is opened too
  await env.DB.batch([
    env.DB.prepare('DELETE FROM subscribers WHERE created_at < ?')
      .bind(new Date(Date.now() - 730 * 864e5).toISOString()),
    env.DB.prepare('DELETE FROM pageviews WHERE day < ?')
      .bind(londonDay(new Date(Date.now() - 120 * 864e5))),
    env.DB.prepare('DELETE FROM searches WHERE day < ?')
      .bind(londonDay(new Date(Date.now() - 120 * 864e5))),
  ]);
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
