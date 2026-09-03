import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Lightweight in-memory rate limit (per warm instance) — anti-flood.
const HITS = new Map();
const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_JANELA = 3;

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ success: false, error: 'Method not allowed.' }, { status: 405 });

  let data;
  try { data = await req.json(); } catch { return Response.json({ success: false, error: 'Invalid request.' }, { status: 400 }); }

  // Honeypot: hidden "website" field — humans leave it empty, bots fill it.
  if (data.website && String(data.website).trim() !== '') {
    return Response.json({ success: true });
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ success: false, error: 'Enter a valid email.' }, { status: 400 });
  }

  const ip = req.headers.get('x-nf-client-connection-ip') || '0';
  const agora = Date.now();
  const recentes = (HITS.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= MAX_POR_JANELA) {
    return Response.json({ success: false, error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }
  recentes.push(agora);
  HITS.set(ip, recentes);

  const record = {
    email,
    produto: data.produto ? String(data.produto).slice(0, 200) : null,
    termo: data.termo ? String(data.termo).slice(0, 200) : null,
    preco_na_inscricao: typeof data.preco === 'number' ? data.preco : null,
    created_at: new Date().toISOString(),
  };

  try {
    const store = getStore('painel');
    await store.setJSON(`sub:${randomUUID()}`, record);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: 'Could not subscribe right now.' }, { status: 502 });
  }
};
