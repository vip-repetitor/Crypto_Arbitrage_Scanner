/**
 * generate-seo.mjs — автогенерация SEO-артефактов при сборке (Vite plugin + CLI).
 *
 * Логика:
 *  1. Единый реестр страниц PAGES — единственный источник правды для
 *     sitemap.xml, robots.txt и статических meta-тегов index.html.
 *     Раньше эти файлы поддерживались вручную и могли рассинхронизироваться
 *     с кодом (был прецедент: лидерборд запрещён в robots, но открыт в метах).
 *  2. buildSitemap() / buildRobots() генерируют XML/TXT из реестра;
 *     changefreq/priority берутся из данных страницы, а не «на глаз».
 *  3. injectStaticMeta() подставляет canonical/OG/description прямо в HTML
 *     на этапе build — краулеры, не исполняющие JS (и превью мессенджеров)
 *     получают корректные теги без SSR-инфраструктуры.
 *  4. Как плагин Vite: writeBundle — пишет артефакты в dist; transformIndexHtml —
 *     внедряет meta. Как CLI: `node scripts/generate-seo.mjs` — генерирует
 *     артефакты в public/ (для ручной регенерации / проверки в CI).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Базовый домен: переопределяется env-переменной SITE_URL (CI/прод),
// иначе остаётся плейсхолдер — тесты целостности требуют абсолютных URL.
export const SITE_URL = (process.env.SITE_URL ?? 'https://bondinvest.ru').replace(/\/+$/, '');

/**
 * Реестр индексируемых страниц.
 * priority/changefreq — сигналы поисковому роботу; indexable=false — исключает
 * страницу из sitemap и добавляет в Disallow robots.txt (закрытые роуты).
 */
export const PAGES = [
  { route: '/',            title: 'BondInvest — индекс участия и бонусы по ОФЗ', description: 'Три цели — три бонуса: держите депозит, растите индекс участия и получайте до 13.75% годовых сверх гарантии 4%. Интерактивный трекер прогресса.', priority: 1.0, changefreq: 'weekly',  indexable: true,  image: '/og-cover.png' },
  { route: '/calc',        title: 'Калькулятор сложного процента онлайн — BondInvest', description: 'Бесплатный калькулятор капитализации: посчитайте доход от реинвестирования бонуса за удержание на горизонте до 10 лет.', priority: 0.9, changefreq: 'monthly', indexable: true,  image: '/og-calc.png' },
  { route: '/leaderboard', title: 'Лидерборд доходностей участников — BondInvest', description: 'Рейтинг пользователей по итоговой доходности: гарантия 4% + премия за индекс участия.', priority: 0.7, changefreq: 'daily',    indexable: true,  image: '/og-cover.png' },
  { route: '/goal/',       title: null, description: null, priority: 0.5, changefreq: 'weekly', indexable: false }, // личные страницы целей
  { route: '/history',     title: null, description: null, priority: 0.3, changefreq: 'weekly', indexable: false }, // личная история
];

/** Экранирование для XML-содержимого (& < > " '). */
const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** today → W3C date для lastmod (поиск не любит future/неточные даты). */
const today = () => new Date().toISOString().slice(0, 10);

/** Генерация sitemap.xml только из indexable-страниц реестра. */
export function buildSitemap(pages = PAGES) {
  const urls = pages
    .filter((p) => p.indexable)
    .map((p) =>
      ['  <url>',
       `    <loc>${xmlEsc(SITE_URL + p.route)}</loc>`,
       `    <lastmod>${today()}</lastmod>`,
       `    <changefreq>${p.changefreq}</changefreq>`,
       `    <priority>${p.priority.toFixed(1)}</priority>`,
       '  </url>'].join('\n'))
    .join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
}

/** robots.txt: все indexable разрешены, прочие пути запрещены. */
export function buildRobots(pages = PAGES) {
  const disallow = pages.filter((p) => !p.indexable).map((p) => `Disallow: ${p.route}`);
  return ['User-agent: *', ...disallow, '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n');
}

/**
 * Статические meta-теги главной страницы для index.html: canonical, OG, Twitter.
 * Динамический setSeoMeta() поверх них обновит DOM в рантайме — здесь же
 * «первый взгляд» краулера и social-ботов.
 */
export function buildStaticMeta(home = PAGES[0]) {
  const url = SITE_URL + home.route;
  const img = SITE_URL + (home.image ?? '/og-cover.png');
  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${xmlEsc(home.title)}" />`,
    `<meta property="og:description" content="${xmlEsc(home.description)}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${xmlEsc(home.title)}" />`,
    `<meta name="twitter:description" content="${xmlEsc(home.description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join('\n    ');
}

const MARKER = '<!-- AUTO-SEO -->';

/** Вставка сгенерированных тегов в <head> HTML по маркеру (идемпотентно). */
export function injectStaticMeta(html) {
  const block = `${MARKER}\n    ${buildStaticMeta()}\n    <!-- /AUTO-SEO -->`;
  if (html.includes(MARKER)) {
    // Замена предыдущей вставки — повторный build не накапливает дубли.
    return html.replace(new RegExp(`${MARKER}[\\s\\S]*<!-- /AUTO-SEO -->`), block);
  }
  return html.replace('</title>', `</title>\n    ${block}`);
}

/** Vite-плагин: transformIndexHtml (dev+build) и writeBundle (dist-артефакты). */
export default function seoGenerator() {
  return {
    name: 'bondinvest-seo-generator',
    transformIndexHtml(html) { return injectStaticMeta(html); },
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      writeFileSync(path.join(dir, 'sitemap.xml'), buildSitemap());
      writeFileSync(path.join(dir, 'robots.txt'), buildRobots());
    },
  };
}

// --- CLI-режим: node scripts/generate-seo.mjs → пишет в ../public ----------
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  writeFileSync(path.join(pub, 'sitemap.xml'), buildSitemap());
  writeFileSync(path.join(pub, 'robots.txt'), buildRobots());
  console.log('[generate-seo] sitemap.xml + robots.txt обновлены из единого реестра PAGES');
  console.log(readFileSync(path.join(pub, 'sitemap.xml'), 'utf8'));
}
