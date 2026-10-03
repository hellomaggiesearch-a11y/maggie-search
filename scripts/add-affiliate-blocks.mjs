#!/usr/bin/env node
/**
 * Insere o bloco de link de afiliado (topo + fim) nos posts do blog UK.
 *
 * Idempotente: marca cada bloco com data-affiliate-block e pula quem já tem.
 * Rode de novo à vontade — não duplica.
 *
 * Publisher e merchant vêm de data/awin_config.json (fonte única da verdade).
 *
 * DESTINO DO LINK: hoje aponta para a home da VioVet. Motivo: a VioVet devolve
 * 403 para requisição automatizada, então não deu para confirmar o formato de
 * busca do site deles. Home nunca quebra e o cookie de afiliado é setado igual.
 * Quando confirmar o formato (ex.: /search?q=termo), troque DEST_BASE abaixo e
 * rode de novo — o script substitui os blocos existentes.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'data/awin_config.json'), 'utf8'));

const AFFID = cfg.awinaffid;
const MID = cfg.merchants.VioVet.awinmid;
const MERCHANT = 'VioVet';
const DEST_BASE = 'https://www.viovet.co.uk/';

/**
 * term: o que a pessoa procuraria na loja. null = o post não vende medicamento
 * (seguro, artigo genérico, ou medicação só aplicada pelo vet).
 * otc: true = produto vendido sem receita (suplemento). O texto não pode falar
 * em receita nem em "o mesmo remédio": suplemento não é remédio.
 */
const POSTS = {
  'apoquel-for-dogs-cost-uk':        { med: 'Apoquel',        term: 'oclacitinib' },
  'atopica-for-dogs-cost-uk':        { med: 'Atopica',        term: 'ciclosporin' },
  'cancer-in-dogs-palladia-cost-uk': { med: 'Palladia',       term: 'toceranib' },
  'cushings-disease-in-dogs-cost-uk':{ med: 'Vetoryl',        term: 'trilostane' },
  'dog-joint-supplements-uk-cost':   { med: 'joint supplements', term: 'joint supplement', otc: true },
  'heart-failure-in-dogs-cost-uk':   { med: 'Vetmedin',       term: 'pimobendan' },
  'hypothyroidism-in-dogs-cost-uk':  { med: 'levothyroxine',  term: 'levothyroxine' },
  'kidney-disease-in-cats-cost-uk':  { med: 'kidney support', term: 'renal' },
  'lifetime-cost-canine-epilepsy-uk':{ med: 'phenobarbital',  term: 'phenobarbital' },
  'librela-cost-uk':                 { med: 'Librela',        term: null },
  'pet-insurance-pros-cons-older-pets': { med: null,          term: null },
  'why-pet-medicine-prices-vary-uk': { med: null,             term: null },
};

const link = (slug) =>
  `https://www.awin1.com/cread.php?awinmid=${MID}&awinaffid=${AFFID}` +
  `&clickref=blog-${slug}&ued=${encodeURIComponent(DEST_BASE)}`;

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const DISCLOSURE =
  'We earn a small commission if you buy through this link. ' +
  'It costs you nothing extra and never changes the prices we show.';

function topBlock(slug, { med, term, otc }) {
  if (otc) {
    return `
  <div class="rx-card" data-affiliate-block="top">
    <p><strong>Shop around &mdash; prices vary a lot.</strong> ${cap(med)} don’t need a prescription, so you can buy them wherever is cheapest. ${MERCHANT} stocks a wide range: <a href="${link(slug)}" rel="sponsored nofollow noopener" target="_blank">compare today’s prices at ${MERCHANT}</a>. <em>${DISCLOSURE}</em></p>
  </div>
`;
  }
  // Só afirma que a loja estoca o remédio quando ele É vendido em farmácia
  // online (term != null). Librela, por exemplo, é injeção aplicada pelo vet:
  // dizer que a VioVet estoca seria falso, e fato errado queima o site inteiro.
  const what = term ? `${med} and its equivalents` : 'your pet’s repeat medication';
  return `
  <div class="rx-card" data-affiliate-block="top">
    <p><strong>Buying it yourself is usually cheaper.</strong> In the UK your vet must give you a <a href="/legal-basis/">written prescription</a> if you ask &mdash; and you can then fill it anywhere. ${MERCHANT} stocks ${what}: <a href="${link(slug)}" rel="sponsored nofollow noopener" target="_blank">check today’s price at ${MERCHANT}</a>. <em>${DISCLOSURE}</em></p>
  </div>
`;
}

function endBlock(slug, { med, term, otc }) {
  if (otc) {
    return `
  <div class="cta-block" data-affiliate-block="end">
    <h3>Where to buy ${med} for less</h3>
    <p>No prescription needed, so you’re free to buy wherever is cheapest. Compare by active ingredient and cost per day &mdash; the same glucosamine, green-lipped mussel or omega-3 often sells at very different prices under different brands.</p>
    <a href="${link(slug)}" rel="sponsored nofollow noopener" target="_blank" class="button">Check prices at ${MERCHANT}</a>
    <p style="margin-top:14px;margin-bottom:0;font-size:13px;opacity:.75">${DISCLOSURE}</p>
  </div>
`;
  }
  const heading = term
    ? `Where to buy ${med} for less`
    : 'Where to buy your pet’s medication for less';
  const body = term
    ? `Ask your vet for a written prescription, then fill it at an online pharmacy. The saving on ${med} is often the difference between a manageable monthly cost and an impossible one — for the same medicine, in the same box.`
    : 'Ask your vet for a written prescription, then fill it at an online pharmacy. For long-term medication the saving compounds every single month — for the same medicine, in the same box.';
  return `
  <div class="cta-block" data-affiliate-block="end">
    <h3>${heading}</h3>
    <p>${body}</p>
    <a href="${link(slug)}" rel="sponsored nofollow noopener" target="_blank" class="button">Check prices at ${MERCHANT}</a>
    <p style="margin-top:14px;margin-bottom:0;font-size:13px;opacity:.75">${DISCLOSURE}</p>
  </div>
`;
}

/**
 * Remove um bloco já inserido, para o script poder rodar de novo.
 * Remove exatamente o que topBlock/endBlock inserem ("\n  <div…</div>\n"),
 * para que rodar N vezes dê o mesmo arquivo. \r?: arquivo salvo no Windows
 * vira CRLF — sem isso o bloco não era achado e o script DUPLICAVA o bloco.
 */
function strip(html, where) {
  const re = new RegExp(
    `\\r?\\n?[ \\t]*<div class="[^"]*" data-affiliate-block="${where}">[\\s\\S]*?</div>\\r?\\n`,
    'g'
  );
  return html.replace(re, '');
}

let changed = 0;
const report = [];

for (const [slug, meta] of Object.entries(POSTS)) {
  const file = join(ROOT, 'blog', slug, 'index.html');
  if (!existsSync(file)) { report.push([slug, 'ARQUIVO NAO ENCONTRADO']); continue; }

  let html = readFileSync(file, 'utf8');
  const before = html;

  html = strip(strip(html, 'top'), 'end');

  // TOPO: logo depois da abertura do <article> — alguns posts usam
  // <article class="content">, por isso a regex em vez de indexOf.
  const art = /<article\b[^>]*>/.exec(html);
  if (!art) { report.push([slug, 'SEM <article> — PULADO']); continue; }
  const after = art.index + art[0].length;
  html = html.slice(0, after) + topBlock(slug, meta) + html.slice(after);

  // FIM: logo antes da lista de tags
  const tagsIdx = html.indexOf('<div class="tags">');
  if (tagsIdx === -1) { report.push([slug, 'SEM div.tags — PULADO']); continue; }
  html = html.slice(0, tagsIdx) + endBlock(slug, meta).trimStart() + '\n  ' + html.slice(tagsIdx);

  if (html !== before) {
    writeFileSync(file, html, 'utf8');
    changed++;
    report.push([slug, meta.med ? `ok — ${meta.med}` : 'ok — bloco genérico']);
  } else {
    report.push([slug, 'sem mudança']);
  }
}

console.log(`\nAwin publisher ${AFFID} · merchant ${MERCHANT} (mid ${MID})`);
console.log(`Destino: ${DEST_BASE}\n`);
for (const [slug, status] of report) console.log(`  ${status.padEnd(28)} ${slug}`);
console.log(`\n${changed} de ${Object.keys(POSTS).length} páginas atualizadas.`);
console.log('clickref por página: blog-<slug> — é isso que liga a venda ao artigo no relatório do Awin.\n');
