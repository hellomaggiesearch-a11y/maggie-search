import { getStore } from '@netlify/blobs';
import { visitorHash, bumpTraffic, bumpSearch, normalizeRefHost } from './_aggregate.mjs';

const SELF_HOST = 'maggiesearch.co.uk';

export default async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response(null, { status: 204 }); }

  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const ip = req.headers.get('x-nf-client-connection-ip') || '0';
  const ua = req.headers.get('user-agent') || '';
  const salt = process.env.PAINEL_SALT || 'painel-fallback-salt';
  const visitor = visitorHash(ip, ua, day, salt);

  const store = getStore('painel');
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const refHost = normalizeRefHost(typeof body.ref === 'string' ? body.ref : '', SELF_HOST);

  const tKey = `traffic:${day}`;
  const tDoc = (await store.get(tKey, { type: 'json' })) || { pageviews: 0, paths: {}, referrers: {}, visitors: [] };
  await store.setJSON(tKey, bumpTraffic(tDoc, { path, refHost, visitor }));

  if (typeof body.q === 'string' && body.q.trim()) {
    const sKey = `searches:${day}`;
    const sDoc = (await store.get(sKey, { type: 'json' })) || {};
    await store.setJSON(sKey, bumpSearch(sDoc, body.q.trim().toLowerCase().slice(0, 80)));
  }

  return new Response(null, { status: 204 });
};
