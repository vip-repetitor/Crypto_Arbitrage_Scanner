/**
 * structuredData.ts — генераторы JSON-LD (Schema.org) для богатых сниппетов.
 *
 * Зачем вынесены в чистый модуль (без React):
 * 1. Чистые функции легко тестировать (валидность структуры, экранирование).
 * 2. Один источник правды по schema-типам: и страница /calc, и App рендерят
 *    блоки из этих функций, поэтому разметка не разъезжается при эволюции продукта.
 * 3. SSR-ready: эти же функции можно вызвать на сервере при prerender.
 *
 * Поддержка поисковиками (2026): FinancialProduct — показывает ставку/условия
 * в сниппете; FAQPage — разворачивает вопросы прямо в выдаче (двойной клик по
 * результату); BreadcrumbList — «хлебные крошки» URL в выдаче; Organization +
 * WebSite с SearchAction — бренд-панель справа от сниппета.
 */

/** Базовый домен сайта. ЗАМЕНИТЬ на реальный домен перед публикацией. */
export const SITE_URL = 'https://bondinvest.ru';
export const SITE_NAME = 'BONDINVEST';

/**
 * Безопасная сериализация JSON-LD.
 * Критично: закрывающая последовательность "</script>" внутри строки JSON
 * иначе оборвёт тег и откроет XSS-вектор. Экранируем "/" как "\u003f —
 * JSON остаётся валидным, а HTML-парсер браузера не видит конец тега.
 */
export function jsonLdScript(json: unknown): string {
  return JSON.stringify(json).replace(/</g, '\\u003c');
}

/** Organization — бренд-панель и сигнал E-E-A-T (доверие к автору контента). */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'Финансовый продукт с индексом участия: ОФЗ-база 4% годовых плюс бонусы до +0.5 к индексу за лояльность, объём и активность.',
    areaServed: { '@type': 'Country', name: 'Россия' },
    knowsAbout: ['сложный процент', 'ОФЗ', 'пассивный доход', 'финансовая грамотность'],
  };
}

/** WebSite + SearchAction — даёт поисковику поле sitelinks searchbox. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: 'ru-RU',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

/**
 * FinancialProduct — главный коммерческий тип разметки.
 * Поля baseCurrency/APR соответствуют требованиям Google к финансовой схеме:
 * годовая ставка указывается ДИАПАЗОНОМ (гарантированные 4% → максимум модели
 * 13.75%), чтобы не вводить пользователя и поисковик в заблуждение.
 */
export function financialProductSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    '@id': `${SITE_URL}/#product`,
    name: 'Индекс участия BONDINVEST',
    description:
      'Доходность из ОФЗ (гарантированные 4% годовых) плюс бонусы к индексу участия: лояльность (+0.3/+0.5), объём (+0.2/+0.4), активность (+0.2/+0.3). При реинвестировании бонус работает по принципу сложного процента.',
    provider: { '@id': `${SITE_URL}/#organization` },
    url: `${SITE_URL}/calc`,
    currency: 'RUB',
    annualPercentageRate: {
      '@type': 'QuantitativeValue',
      minValue: 4,
      maxValue: 13.75,
      unitCode: 'P1Y',
    },
    feesAndCommission:
      'Комиссия за ведение счёта отсутствует; маржа компании заложена в доходность базового актива (3 п.п. из 11% ОФЗ-полосы).',
  };
}

/** Вопросы для FAQPage — совпадают с видимым текстом на /calc (требование Google). */
export const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Что такое сложный процент?',
    answer:
      'Сложный процент (капитализация) — начисление дохода не только на исходную сумму, но и на уже полученные проценты. Каждый новый доход увеличивает базу для следующего начисления, поэтому рост ускоряется со временем.',
  },
  {
    question: 'Как бонус к индексу участия связан со сложным процентом?',
    answer:
      'Бонус к индексу — не разовая надбавка: при реинвестировании он попадает в базу следующего периода. Например, с 100 000 ₽ бонус +0,0375% даёт 37,5 ₽ за год, а на второй год доход начисляется уже на 100 037,5 ₽. Чем дольше соблюдается правило удержания, тем сильнее эффект.',
  },
  {
    question: 'Зачем держать депозит 20 недель?',
    answer:
      'Потому что длинный горизонт даёт не только больший бонус (+0.5 вместо +0.3), но и время для эффекта сложного процента: закрепённый бонус дольше работает в базе капитализации.',
  },
  {
    question: 'Какая максимальная доходность у BONDINVEST?',
    answer:
      'Гарантированная база — 4% годовых (купон ОФЗ). С полным индексом участия 1.3 суммарная доходность достигает ~13.75% годовых без дополнительных рисков относительно базового актива.',
  },
];

/** FAQPage — разворачивает вопросы прямо в поисковой выдаче. */
export function faqPageSchema(items: Array<{ question: string; answer: string }> = FAQ_ITEMS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** BreadcrumbList — хлебные крошки в сниппете. Передается путь текущей страницы. */
export function breadcrumbSchema(
  crumbs: Array<{ name: string; path: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}
