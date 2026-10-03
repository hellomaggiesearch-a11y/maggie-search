#!/usr/bin/env node
/**
 * Gera o post "Your Legal Right to a Written Prescription" a partir de um post
 * existente usado como molde. Herda CSS, header, footer e disclaimer do site —
 * assim o post novo não diverge visualmente nem exige CSS novo.
 *
 * Roda de novo sem problema: reescreve o arquivo de saída por inteiro.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'blog/librela-cost-uk/index.html');
const SLUG = 'your-right-to-a-written-prescription-uk';
const OUT_DIR = join(ROOT, 'blog', SLUG);

const TITLE = 'Your Legal Right to a Written Prescription (And What It Saves You)';
const DESC = 'UK vets must give you a written prescription if you ask. From December 2026 the fee is capped at £21. What the CMA decided, what it saves you, and the exact words to use.';
const URL = `https://maggiesearch.co.uk/blog/${SLUG}/`;
const PUB = '2026-09-29';
const PUB_HUMAN = '29 September 2026';
const OG_IMAGE = 'https://maggiesearch.co.uk/assets/img/og/maggie-search-default-og.webp';

const AWIN = 'https://www.awin1.com/cread.php?awinmid=6960&awinaffid=2955355' +
  `&clickref=blog-${SLUG}&ued=https%3A%2F%2Fwww.viovet.co.uk%2F`;

const DISCLOSURE = 'We earn a small commission if you buy through this link. It costs you nothing extra and never changes the prices we show.';

const HEAD_BLOCK = `
<div class="wrap">
  <div class="eyebrow">Price Watch · Your rights</div>
  <h1>${TITLE}</h1>
  <p class="lede">Your vet has to give you a written prescription if you ask for one. That has been true for years. What changed in March 2026 is that there is now a legal ceiling on what they can charge you for it — and for most long-term medication, the maths is no longer close.</p>
  <div class="byline">Maggie Search Editorial Team · Published <time datetime="${PUB}">${PUB_HUMAN}</time></div>
  <!-- REVIEWER_LINE -->
</div>

<article>
  <div class="rx-card" data-affiliate-block="top">
    <p><strong>The short version.</strong> Ask your vet for a written prescription, then fill it at an online pharmacy. From December 2026 the prescription fee is capped at £21 for the first medicine and £12.50 for each one after that. <a href="${AWIN}" rel="sponsored nofollow noopener" target="_blank">Check what your pet's medicine costs at VioVet</a> before you decide. <em>${DISCLOSURE}</em></p>
  </div>

  <h2>What the CMA actually decided</h2>
  <p>On <strong>24 March 2026</strong> the Competition and Markets Authority published the final report of a two-and-a-half year investigation into the UK veterinary market. It is not a gentle document. The CMA found systemic problems with price transparency, inflated prescription fees and ownership that pet owners could not see — and put the cost to consumers at roughly <strong>£1.7 billion over five years</strong>.</p>
  <p>One number explains why the investigation happened at all: between 2016 and 2023, veterinary prices rose <strong>63%</strong>. That is roughly twice the rate of inflation over the same period. Wages did not do that. Pet insurance did not absorb it. The difference came out of ordinary households, one invoice at a time.</p>

  <h2>The part that changes your monthly bill</h2>
  <p>Among fifteen remedies, one lands directly in your pocket. The fee a practice can charge for writing a prescription is being capped:</p>
  <ul>
    <li><strong>£21</strong> for the first medicine</li>
    <li><strong>£12.50</strong> for each additional medicine on the same prescription</li>
  </ul>
  <p>Some practices had been charging £40 or more — which, conveniently, was often just enough to make asking for a prescription feel pointless. That was the problem. A fee set high enough to cancel out the saving is not a fee; it is a gate.</p>

  <div class="rx-card warn">
    <h4>⚠️ Read this bit carefully — the dates matter</h4>
    <p>The cap was <strong>decided</strong> in March 2026, but it is not in force yet. The first phase applies to larger veterinary businesses from <strong>23 December 2026</strong>, with later dates running into 2027 for the rest. Until your practice's date arrives, they can still charge what they charge. You can still ask for the prescription — you have always been able to — but check the fee before you assume it is £21.</p>
  </div>

  <h2>You always had the right. Most people never used it.</h2>
  <p>Under the RCVS Code of Professional Conduct, a UK vet must provide a written prescription on request rather than insisting you buy the medicine from them. This is not a favour and it is not a grey area. Asking for one is not rude, it does not signal distrust, and it will not affect how your animal is treated.</p>
  <p>The reason so few owners ask is simpler than it looks: nobody tells them. The prescription is rarely offered. The medicine is handed over at the desk with the bill, the moment passes, and the same thing happens again next month for the next three years.</p>

  <h2>The maths: when it is worth asking</h2>
  <p>The calculation has three numbers, and you can do it on your phone at the reception desk.</p>
  <ol>
    <li><strong>What the practice charges</strong> for the medicine over the period the prescription covers.</li>
    <li><strong>What an online pharmacy charges</strong> for the same medicine, same strength, same quantity.</li>
    <li><strong>The prescription fee.</strong></li>
  </ol>
  <p>If <em>(1 − 2)</em> is bigger than <em>(3)</em>, you are better off with the prescription. For a one-off course of antibiotics, it often is not worth it. For anything your animal takes every day for the rest of its life — heart medication, thyroid, epilepsy, Cushing's, skin allergy — it usually is, and by a margin that compounds every month.</p>
  <p>A prescription typically covers repeat dispensing for a period, so one fee can cover several months of medicine. That single detail is what moves most long-term cases firmly into "worth it".</p>

  <h2>How to ask</h2>
  <p>There is no special form of words, but something plain and unembarrassed works best. At the end of the consultation:</p>
  <div class="rx-card">
    <p><em>"Could I have a written prescription for that, please? I'd like to compare prices. What's your prescription fee?"</em></p>
  </div>
  <p>Ask for the fee in the same breath. It stops the conversation needing a second round, and it tells you immediately whether the saving is real for your animal's particular medicine.</p>
  <p>If you are already on a repeat medication and have never asked, you do not need to wait for the next consultation — phone the practice and ask what their process is for a repeat prescription.</p>

  <h2>What else the CMA is making practices do</h2>
  <p>The prescription cap is the headline, but three other remedies are worth knowing, because they change what you are entitled to see:</p>
  <ul>
    <li><strong>A written estimate in advance</strong> for any treatment expected to cost £500 or more, plus an itemised bill for everything.</li>
    <li><strong>Clear disclosure of ownership</strong> — practices must say whether they are independent or part of a group. A great many surgeries that look independent are not, and pricing tends to be set above the individual practice.</li>
    <li><strong>A transparent complaints process</strong>, with mediation where a dispute cannot be settled in-house.</li>
  </ul>
  <p>The RCVS will monitor compliance with these orders, funded by a new levy on the businesses themselves.</p>

  <h2>When a prescription is not the answer</h2>
  <p>Being honest about the limits is what makes the rest of this useful:</p>
  <ul>
    <li><strong>Medicines given by injection at the practice</strong> — a monthly injectable is administered by the vet, so there is nothing for you to fill elsewhere.</li>
    <li><strong>Anything urgent.</strong> If your animal needs treatment today, take the medicine today. Optimise the repeat, not the emergency.</li>
    <li><strong>Short courses.</strong> A ten-day course rarely beats the fee.</li>
    <li><strong>Very low-cost medicines</strong>, where the whole month costs less than the prescription fee.</li>
  </ul>

  <h2>Where to fill it</h2>
  <p>A UK online veterinary pharmacy will ask you to post the original written prescription, or will accept it from your vet directly. The medicine is the same medicine — same manufacturer, same box, same regulatory approval under the VMD. What differs is the margin.</p>
  <p>Before you decide anything, get the two numbers side by side: what your practice charges, and what the same product costs online. That comparison is the entire point of this site.</p>

  <h2>The bottom line</h2>
  <p>The CMA spent two and a half years establishing something most pet owners already suspected: that they were paying more than they needed to, and that the system was not built to tell them so. The remedies help. But the single most effective thing you can do does not require waiting for December 2026, or for any regulator at all.</p>
  <p>Ask for the prescription. Then check the price.</p>
`;

const TAIL_BLOCK = `
  <div class="cta-block" data-affiliate-block="end">
    <h3>Check what you'd actually pay</h3>
    <p>You have the right to the prescription. The only question left is whether the saving is worth the fee for your animal's specific medicine — and that takes one comparison.</p>
    <a href="${AWIN}" rel="sponsored nofollow noopener" target="_blank" class="button">Check prices at VioVet</a>
    <p style="margin-top:14px;margin-bottom:0;font-size:13px;opacity:.75">${DISCLOSURE}</p>
  </div>

  <div class="tags">
    <span class="tag">written prescription UK</span>
    <span class="tag">CMA vet investigation</span>
    <span class="tag">prescription fee cap</span>
    <span class="tag">save money on pet medication</span>
  </div>

  <div class="ingredients-panel">
    <h4>Sources &amp; further reading</h4>
    <ul>
      <li><a href="https://www.gov.uk/cma-cases/veterinary-services-market-investigation" rel="noopener" target="_blank">CMA — Veterinary services for household pets: market investigation</a></li>
      <li><a href="https://www.rcvs.org.uk/setting-standards/advice-and-guidance/code-of-professional-conduct-for-veterinary-surgeons/" rel="noopener" target="_blank">RCVS — Code of Professional Conduct for Veterinary Surgeons</a></li>
      <li><a href="https://www.vmd.defra.gov.uk/productinformationdatabase/" rel="noopener" target="_blank">Veterinary Medicines Directorate (VMD) — Product Information Database</a></li>
      <li><a href="/legal-basis/">Maggie Search — the legal basis we operate under</a></li>
    </ul>
  </div>
</article>
`;

// ---------------------------------------------------------------------------

let html = readFileSync(TEMPLATE, 'utf8');

// 1) Metadados do <head>
const meta = [
  [/<title>[\s\S]*?<\/title>/, `<title>${TITLE} — Maggie Search</title>`],
  [/<meta name="description" content="[^"]*">/, `<meta name="description" content="${DESC}">`],
  [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${URL}">`],
  [/<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${TITLE}"/>`],
  [/<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${DESC}"/>`],
  [/<meta property="og:url" content="[^"]*"\/>/, `<meta property="og:url" content="${URL}"/>`],
  [/<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${TITLE}"/>`],
  [/<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${DESC}"/>`],
  // O molde aponta a imagem social para a foto do próprio post dele; este post
  // não tem imagem, então usa a imagem padrão do site.
  [/<meta property="og:image" content="[^"]*"\/>/, `<meta property="og:image" content="${OG_IMAGE}"/>`],
  [/<meta name="twitter:image" content="[^"]*"\/>/, `<meta name="twitter:image" content="${OG_IMAGE}"/>`],
  [/<meta property="og:image:alt" content="[^"]*"\/>/, `<meta property="og:image:alt" content="Maggie Search — compare UK vet medicine prices by active ingredient"/>`],
];
for (const [re, rep] of meta) {
  if (!re.test(html)) console.warn(`  aviso: não casou ${re}`);
  html = html.replace(re, rep);
}

// 2) Schema JSON-LD — reescreve os blocos do molde
html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (block) => {
  if (block.includes('BreadcrumbList')) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://maggiesearch.co.uk/" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://maggiesearch.co.uk/blog/" },
    { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(TITLE)} }
  ]
}
</script>`;
  }
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": ${JSON.stringify(TITLE)},
  "description": ${JSON.stringify(DESC)},
  "url": ${JSON.stringify(URL)},
  "inLanguage": "en-GB",
  "datePublished": ${JSON.stringify(PUB)},
  "author": { "@type": "Organization", "name": "Maggie Search" },
  "publisher": { "@type": "Organization", "name": "Maggie Search" }
}
</script>`;
});

// 3) Corpo: troca tudo entre a abertura do .wrap do post e o fim do <article>
const startIdx = html.indexOf('<div class="wrap">');
const endIdx = html.indexOf('</article>');
if (startIdx === -1 || endIdx === -1) {
  console.error('Molde inesperado: não achei <div class="wrap"> ou </article>. Nada escrito.');
  process.exit(1);
}
html = html.slice(0, startIdx)
  + HEAD_BLOCK.trimStart()
  + TAIL_BLOCK.trimStart().replace(/<\/article>\s*$/, '')
  + html.slice(endIdx);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8');

console.log(`\nGerado: blog/${SLUG}/index.html  (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`clickref: blog-${SLUG}`);
console.log('Molde: blog/librela-cost-uk/ — CSS, header e footer herdados.\n');
