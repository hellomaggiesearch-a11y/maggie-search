// POST /api/track — anonymous page view + search counter (only sent after
// the visitor accepts analytics). Visitor id = daily salted hash, never the IP.
import { ensureSchema, londonDay, sha256Hex, normalizeRefHost, clientIp } from '../../lib/painel.js';

const SELF_HOST = 'maggiesearch.co.uk';
const RETENTION_DAYS = 120;
const SUBSCRIBER_RETENTION_DAYS = 730;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return new Response(null, { status: 204 }); }
  if (!env.DB) return new Response(null, { status: 204 });

  const day = londonDay();
  const ua = request.headers.get('user-agent') || '';
  const salt = env.PAINEL_SALT || 'painel-fallback-salt';
  const visitor = await sha256Hex(`${clientIp(request)}|${ua}|${day}|${salt}`);
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const ref = normalizeRefHost(typeof body.ref === 'string' ? body.ref : '', SELF_HOST);

  try {
    await ensureSchema(env.DB);
    const stmts = [
      env.DB.prepare('INSERT INTO pageviews (day, path, ref, visitor) VALUES (?, ?, ?, ?)')
        .bind(day, path, ref, visitor),
    ];
    if (typeof body.q === 'string' && body.q.trim()) {
      stmts.push(env.DB.prepare('INSERT INTO searches (day, term) VALUES (?, ?)')
        .bind(day, body.q.trim().toLowerCase().slice(0, 80)));
    }
    // housekeeping: ~1% of requests drop rows older than the retention window
    if (Math.random() < 0.01) {
      const cutoff = londonDay(new Date(Date.now() - RETENTION_DAYS * 864e5));
      stmts.push(env.DB.prepare('DELETE FROM pageviews WHERE day < ?').bind(cutoff));
      stmts.push(env.DB.prepare('DELETE FROM searches WHERE day < ?').bind(cutoff));
      // privacy policy: alert sign-ups are deleted 24 months after sign-up at the latest
      const subCutoff = new Date(Date.now() - SUBSCRIBER_RETENTION_DAYS * 864e5).toISOString();
      stmts.push(env.DB.prepare('DELETE FROM subscribers WHERE created_at < ?').bind(subCutoff));
    }
    await env.DB.batch(stmts);
  } catch { /* analytics must never break the page */ }

  return new Response(null, { status: 204 });
}

export function onRequest() {
  return new Response(null, { status: 405 });
}
