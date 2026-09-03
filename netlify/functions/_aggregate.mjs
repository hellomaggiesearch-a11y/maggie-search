import { createHash } from 'node:crypto';

export function visitorHash(ip, ua, day, salt) {
  return createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex');
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

export function bumpTraffic(doc, { path, refHost, visitor }) {
  const d = {
    pageviews: doc.pageviews || 0,
    paths: { ...doc.paths },
    referrers: { ...doc.referrers },
    visitors: [...(doc.visitors || [])],
  };
  d.pageviews += 1;
  if (path) d.paths[path] = (d.paths[path] || 0) + 1;
  if (refHost) d.referrers[refHost] = (d.referrers[refHost] || 0) + 1;
  if (visitor && !d.visitors.includes(visitor)) d.visitors.push(visitor);
  return d;
}

export function bumpSearch(doc, term) {
  const d = { ...doc };
  if (term) d[term] = (d[term] || 0) + 1;
  return d;
}

export function topN(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}
