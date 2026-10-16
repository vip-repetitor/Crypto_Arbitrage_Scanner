/**
 * structuredData.test.ts — юнит-тесты SEO wave 2 (JSON-LD генераторы).
 *
 * Проверяем то, за что поисковики штрафуют сильнее всего:
 * 1. Валидность JSON и обязательные поля @context/@type.
 * 2. Отсутствие HTML-последовательности "</script>" внутри сериализованного
 *    JSON-LD (XSS/битый head) — экранирование "<".
 * 3. Требование Google: FAQ-разметка = видимый текст (общий источник FAQ_ITEMS).
 * 4. Числа APR соответствуют финансовой модели (4% база … 13.75% потолок).
 */
import { describe, expect, it } from 'vitest';
import {
  SITE_URL,
  breadcrumbSchema,
  faqPageSchema,
  financialProductSchema,
  jsonLdScript,
  organizationSchema,
  websiteSchema,
  FAQ_ITEMS,
} from '../utils/structuredData';

describe('jsonLdScript', () => {
  it('валидный JSON без последовательности </script>', () => {
    const payload = { evil: '</script><script>alert(1)</script>' };
    const serialized = jsonLdScript(payload);
    expect(serialized).not.toContain('</script>');
    expect(serialized).not.toContain('<');
    // И при этом остаётся парсible JSON
    expect(JSON.parse(serialized.replace(/\\u003c/g, '<')).evil).toBe(payload.evil);
  });
});

describe('JSON-LD схемы', () => {
  it('каждая схема имеет @context schema.org и @type', () => {
    for (const schema of [organizationSchema(), websiteSchema(), financialProductSchema()]) {
      expect(schema['@context']).toBe('https://schema.org');
      expect(typeof schema['@type']).toBe('string');
    }
  });

  it('FinancialProduct: APR-диапазон совпадает с математикой модели (4…13.75)', () => {
    const apr = financialProductSchema().annualPercentageRate;
    expect(apr.minValue).toBe(4); // гарантированная ОФЗ-база
    expect(apr.maxValue).toBeCloseTo(4 + 1.3 * 7.5, 2); // индекс 1.3 × 7.5 п.п./шаг
  });

  it('FAQ mainEntity покрывает все FAQ_ITEMS (единый источник для текста и схемы)', () => {
    const faq = faqPageSchema(FAQ_ITEMS);
    expect(faq.mainEntity).toHaveLength(FAQ_ITEMS.length);
    faq.mainEntity.forEach((entry, i) => {
      expect(entry.name).toBe(FAQ_ITEMS[i].question);
      expect(entry.acceptedAnswer.text).toBe(FAQ_ITEMS[i].answer);
    });
  });

  it('breadcrumb строит абсолютные URL и позиции 1..n', () => {
    const crumbs = breadcrumbSchema([
      { name: 'Главная', path: '/' },
      { name: 'Калькулятор', path: '/calc' },
    ]);
    expect(crumbs.itemListElement[0].item).toBe(`${SITE_URL}/`);
    expect(crumbs.itemListElement[1].position).toBe(2);
  });
});
