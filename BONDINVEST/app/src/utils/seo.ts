/**
 * seo.ts — утилита динамической SEO-метаданных для SPA.
 *
 * Логика работы:
 * 1. React-приложение — single page app, поэтому index.html статичен и содержит
 *    базовые метатеги главной страницы. При переходе на /goal/:id, /history,
 *    /leaderboard или /calc заголовки и описания должны меняться — иначе поисковик
 *    видит «одну и ту же страницу» под всеми URL (каннибализация).
 * 2. setSeoMeta() обновляет document.title, meta[name="description"] и канонический
 *    <link rel="canonical"> по переданному объекту PageMeta.
 * 3. Функция идемпотентна: теги создаются только при отсутствии, переиспользуются
 *    при повторных вызовах (не плодим дубли в <head>).
 * 4. Тексты собираются из живых данных (индекс, цель), поэтому сниппеты в выдаче
 *    соответствуют реальному состоянию продукта.
 */

/** Домен продакшена — используется для canonical и og:url. */
const SITE_ORIGIN = 'https://bondinvest.ru';

/** Описание набора метаданных одной страницы. */
export interface PageMeta {
  /** Текст <title> (до ~60 символов — не обрезается в выдаче). */
  title: string;
  /** Текст meta description (до ~160 символов — оптимально для сниппета). */
  description: string;
  /** Путь страницы относительно домена, например '/goal/volume'. */
  path: string;
}

/**
 * Находит (или создаёт) тег по селектору и выставляет ему атрибут content/href.
 * Вспомогательная: инкапсулирует «создать, если нет» чтобы setSeoMeta оставалась
 * читаемой и не мутировала DOM вслепую.
 */
function upsertTag(selector: string, attr: 'content' | 'href', value: string): void {
  let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!el) {
    // Тег отсутствует — создаём элемент нужного типа (meta или link).
    el = selector.startsWith('meta')
      ? document.createElement('meta')
      : document.createElement('link');
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Применяет метаданные страницы к документу: title + description + canonical + OG/Twitter.
 * Вызывается из хука usePageMeta() на каждом роуте при смене маршрута/данных.
 */
export function setSeoMeta(meta: PageMeta): void {
  const url = `${SITE_ORIGIN}${meta.path}`;
  document.title = meta.title;

  // Ключевые теги для поисковых систем:
  upsertTag('meta[name="description"]', 'content', meta.description);
  upsertTag('link[rel="canonical"]', 'href', url);

  // Социальные превью (VK/Telegram/Twitter читают их при шеринге ссылки):
  upsertTag('meta[property="og:title"]', 'content', meta.title);
  upsertTag('meta[property="og:description"]', 'content', meta.description);
  upsertTag('meta[property="og:url"]', 'content', url);
  upsertTag('meta[name="twitter:title"]', 'content', meta.title);
  upsertTag('meta[name="twitter:description"]', 'content', meta.description);
}

/* ============================================================
 * Генераторы текстов по страницам. Держим шаблоны рядом с типами:
 * маркетологу проще править формулировки в одном файле, а не
 * разбросанными по компонентам.
 * ============================================================ */

/** Главная: бренд + ключевой оффер «три цели — три бонуса». */
export const HOME_META: PageMeta = {
  title: 'BONDINVEST — индекс участия: три цели, три бонуса, до 10% годовых',
  description:
    'Инвестиции в реальные ОФЗ: гарантированные 4% годовых + бонусы за лояльность, объём и активность. Следите за прогрессом и доходностью по сложному проценту.',
  path: '/',
};

/** Детали цели: подставляем название и юнит — уникальные тайтлы на /goal/*. */
export function goalMeta(title: string, current: number, target: number, unit: string): PageMeta {
  return {
    title: `${title}: ${current}/${unit} из ${target} — BONDINVEST`,
    description: `Цель «${title}» в индексе участия BONDINVEST: текущий прогресс ${current} ${unit} из ${target}. Узнайте пороги, бонус к доходности и пошаговый план достижения.`,
    path: `/goal/${title.toLowerCase()}`,
  };
}

/** История бонусов: ключ «история выплат ОФЗ». */
export const HISTORY_META: PageMeta = {
  title: 'История бонусов и выплат — BONDINVEST',
  description:
    'Все начисления бонусов за лояльность, объём и активность: суммы, даты, фильтры и экспорт в CSV. Прозрачная история доходности вашего индекса участия.',
  path: '/history',
};

/** Лидерборд: социальное доказательство + ключ «доходность пользователей». */
export const LEADERBOARD_META: PageMeta = {
  title: 'Лидерборд доходностей — статистика всех участников BONDINVEST',
  description:
    'Реальная статистика индексов участия и годовых доходностей пользователей: от 4% гарантии до 10% с бонусами. Сравните свой результат с топ-участниками.',
  path: '/leaderboard',
};

/** Калькулятор сложного процента — главная SEO-страница-магнит (tool page). */
export const CALC_META: PageMeta = {
  title: 'Калькулятор сложного процента — доходность ОФЗ с бонусами | BONDINVEST',
  description:
    'Бесплатный калькулятор сложного процента для сбережений: покажет, как реинвестирование дохода увеличивает базу каждый год. Считаем по модели BONDINVEST — 4% гарантия + бонусы до 10%.',
  path: '/calc',
};
