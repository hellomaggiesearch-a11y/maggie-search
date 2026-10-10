// POST /api/subscribe — price-drop alert email capture.
import { ensureSchema, clientIp, json } from '../../lib/painel.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Lightweight in-memory rate limit (per warm isolate) — anti-flood.
const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ success: false, error: 'Invalid request.' }, { status: 400 }); }

  // Honeypot: hidden "website" field — humans leave it empty, bots fill it.
  if (data.website && String(data.website).trim() !== '') return json({ success: true });

  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ success: false, error: 'Enter a valid email.' }, { status: 400 });
  }

  const ip = clientIp(request);
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return json({ success: false, error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }
  recent.push(now);
  HITS.set(ip, recent);

  try {
    await ensureSchema(env.DB);
    await env.DB.prepare(
      'INSERT INTO subscribers (email, produto, termo, preco_na_inscricao, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      email,
      data.produto ? String(data.produto).slice(0, 200) : null,
      data.termo ? String(data.termo).slice(0, 200) : null,
      typeof data.preco === 'number' ? data.preco : null,
      new Date().toISOString(),
    ).run();
    return json({ success: true });
  } catch {
    return json({ success: false, error: 'Could not subscribe right now.' }, { status: 502 });
  }
}

export function onRequest() {
  return json({ success: false, error: 'Method not allowed.' }, { status: 405 });
}
