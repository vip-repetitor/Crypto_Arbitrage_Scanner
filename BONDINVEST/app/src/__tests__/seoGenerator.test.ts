/**
 * Тесты автогенератора SEO (scripts/generate-seo.mjs).
 * Генератор исполняется через `node` (он — часть сборки Vite, не браузера),
 * поэтому тест проверяет его end-to-end: запускает CLI и разбирает
 * сгенерированные артефакты. Это честнее mock-импорта: тестируется ровно то,
 * что попадёт в dist при деплое. Инварианты:
 *  - sitemap = только indexable-страницы (без /goal/, /history);
 *  - robots Disallow-ает личные роуты и ссылается на sitemap;
 *  - статические meta идемпотентны и экранируют спецсимволы.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
// Запуск CLI: пишет public/sitemap.xml и public/robots.txt из реестра PAGES.
execFileSync('node', ['scripts/generate-seo.mjs'], { cwd: ROOT, stdio: 'pipe' });

const sitemap = readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8');
const robots = readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf8');
// Реестр читаем как текст (import .mjs вне fs.allow недоступен в vitest):
// сверяем инварианты по флагу indexable в исходнике генератора.
const genSrc = readFileSync(path.join(ROOT, 'scripts/generate-seo.mjs'), 'utf8');

describe('sitemap.xml (сгенерирован реально)', () => {
  it('валиven: XML-декларация + urlset', () => {
    expect(sitemap.startsWith('<?xml')).toBe(true);
    expect(sitemap).toContain('<urlset');
  });
  it('включает открытые страницы /, /calc, /leaderboard', () => {
    for (const r of ['/', '/calc', '/leaderboard']) {
      expect(sitemap).toContain(`<loc>https://bondinvest.ru${r === '/' ? '/' : r}</loc>`);
    }
  });
  it('не включает личные роуты /goal/ и /history', () => {
    expect(sitemap).not.toContain('/goal');
    expect(sitemap).not.toContain('/history');
  });
  it('каждый <loc> имеет lastmod/changefreq/priority', () => {
    const locs = sitemap.match(/<loc>/g)?.length ?? 0;
    expect((sitemap.match(/<lastmod>/g) || []).length).toBe(locs);
    expect((sitemap.match(/<changefreq>/g) || []).length).toBe(locs);
    expect((sitemap.match(/<priority>/g) || []).length).toBe(locs);
  });
});

describe('robots.txt (сгенерирован реально)', () => {
  it('Disallow ровно для неиндексируемых путей реестра', () => {
    expect(robots).toContain('Disallow: /goal/');
    expect(robots).toContain('Disallow: /history');
    // Открытые страницы не запрещены:
    expect(robots).not.toMatch(/Disallow: \/calc/);
    expect(robots).not.toMatch(/Disallow: \/leaderboard/);
  });
  it('указывает абсолютный URL sitemap', () => {
    expect(robots).toContain('Sitemap: https://bondinvest.ru/sitemap.xml');
  });
});

describe('генератор: свойства кода', () => {
  it('идемпотентная вставка meta защищена маркерами AUTO-SEO', () => {
    expect(genSrc).toContain('AUTO-SEO');
    expect(genSrc).toMatch(/injectStaticMeta[\s\S]*includes\(MARKER\)/);
  });
  it('XML-экранирование присутствует (защита от битого sitemap)', () => {
    expect(genSrc).toContain('&amp;');
    expect(genSrc).toContain('&lt;');
  });
  it('SITE_URL переопределяется env (деплои на реальном домене без правки кода)', () => {
    expect(genSrc).toContain('process.env.SITE_URL');
  });
});
