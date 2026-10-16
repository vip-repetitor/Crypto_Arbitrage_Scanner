# Референсы премиальных резюме — исследование дизайн-паттернов

**Важно о честности источника.** В данной среде у меня **нет доступа к интернету**,
поэтому я физически не мог открыть и проверить конкретные URL. Чтобы не выдумывать
ссылки, каждый референс помечен статусом:

- `VERIFIED (offline)` — паттерн основан на общепризнанных правилах вёрстки/типографики,
  которые воспроизводимы локально (CSS-спецификации, системные шрифты, печать из браузера).
  Конкретный макет-источник не открывался.
- `UNVERIFIED` — название известной платформы/эстетики, упомянутое **как ориентир стиля
  без проверки актуального вида**. Копирование макетов не производилось; извлечены только
  абстрактные паттерны (палитра, ритм, типографика).

Ничей макет целиком не скопирован. Ниже — 20 референсов-паттернов.

---

## 1. Таблица референсов

| # | Референс / источник | Статус | Что извлекаем (паттерн) | Применение в проекте |
|---|---------------------|--------|--------------------------|----------------------|
| 1 | LinkedIn Profile (общий вид профиля) | UNVERIFIED | Круг фото + кольцо-акцент, имя крупно, роль прописными с трекингом | `.sr-photo-ring`, `.sr-rank` |
| 2 | Resume.io — премиум-шаблоны «Executive» | UNVERIFIED | Двухколоночная шапка тёмный/светлый, metadata pill-строкой | `.sr-header`, `.sr-pill` |
| 3 | Zety — шаблоны «Professional» | UNVERIFIED | Тонкая цветная линия-разделитель под шапкой (hairline rule) | `.sr-hairline` |
| 4 | Novoresume — шаблоны «Design/Creative» | UNVERIFIED | Секционные заголовки UPPERCASE + короткий underline-акцент | `.sr-section-title`, `.sr-section-sub` |
| 5 | Canva — «Luxury Résumé» категории | UNVERIFIED | Чёрный+золотой, serif-имя, много воздуха | палитра Black Champagne |
| 6 | Teal HQ — современный one-page CV | UNVERIFIED | Карточки-чипы контактов, скругления, мягкие тени | pill-контейнеры |
| 7 | Kickresume — «Elegant» шаблоны | UNVERIFIED | Serif-заголовки + sans-текст (пары Georgia/Arial) | `--font-serif` + `--font-sans` |
| 8 | FlowCV — чистые таблицы опыта | UNVERIFIED | Zebra-подсветка строк, тонкие границы, большие ячейки | `table.sr-table` |
| 9 | Reactive Resume (open-source) | UNVERIFIED | Строгая сетка personal info «ключ–значение» | `.sr-info-grid` dotted leaders |
| 10 | JSON Resume темы (minimalist) | VERIFIED (offline) | Данные и представление разделены; экспорт = один файл | схема данных + standalone HTML |
| 11 | Swiss / International Typographic Style (Мюллер-Брокманн) | VERIFIED (offline) | Модульная сетка, базовая линия 8px, выравнивание, минимум декора | отступы кратны 8, hairlines |
| 12 | Editorial-вёрстка мужских глянцев (GQ/Esquire, общий стиль) | UNVERIFIED | Крупное serif-имя, контраст кеглей, узкий трекинг капса | `.sr-name` 34px serif |
| 13 | Люкс-е-коммерция (Hermès/Cartier digital, общий стиль) | UNVERIFIED | Один металлический акцент на глубоком тёмном фоне, тонкие золотые линии | градиент gold-hairline |
| 14 | Rolls-Royce Motors Website (тёмный люкс-авто) | UNVERIFIED | Radial-подсветка сверху («прожектор»), конические металлические градиенты | radial-gradient в шапке, conic-кольцо фото |
| 15 | Financial Times / Bloomberg terminal (финансовая эстетика) | UNVERIFIED | Cream-paper фон #F5F2E8 + dark ink + приглушённые акценты | `--cream`, print-режим |
| 16 | Notion / Linear (SaaS-минимализм) | UNVERIFIED | Мягкие тени двух уровней (ambient + key), radius 12–16 | `--shadow`, `--radius` |
| 17 | Apple HIG — материалы и глубина | UNVERIFIED | Слои, полупрозрачность поверх тёмного фона (`rgba(255,255,255,.06)`) | pill на прозрачном фоне |
| 18 | Marine engineering / yacht brochure (судостроительные буклеты) | UNVERIFIED | Морская семантика: стальной канат, такелаж, deep navy | `.sr-rope` (repeating-linear-gradient) |
| 19 | Merchant Navy / STCW certificate layout | UNVERIFIED | Таблицы сертификатов «name — valid until», grid в 2 колонки | `.sr-certs` |
| 20 | Print-ready A4 resume CSS (browser print behaviour) | VERIFIED (offline) | `@media print`: убрать тени, растянуть на страницу, `print-color-adjust: exact` | блок печати в premium.css |

Итого: 20 референсов; 3 из них `VERIFIED (offline)` — паттерны, подтверждённые
спецификациями и локальной проверкой; остальные 17 — `UNVERIFIED` ориентиры по стилю
(названы как направление, актуальный вид источников не проверялся).

---

## 2. Извлечённые design patterns (что именно переносим)

### Цвет
- Глубокий тёмно-синий `#0B1F3A → #14315C` как «дорогой» фон; бумага `#FFFFFF/#F5F2E8`.
- Металлический акцент — золото `#C9A227` с бликом `#E3C56A`; не более 2 акцентных цветов.
- Вторичный текст: `#6b7686`; placeholder — курсив `#aab2bf`.

### Типографика
- Пара serif (имена/заголовки) × sans (данные). Offline-safe стеки: Georgia/Times и system-ui.
- Имя: 32–36px, weight 600, letter-spacing ~1px. Роль: 14–16px, UPPERCASE, tracking 3px.
- Заголовки секций: 17–19px UPPERCASE, tracking 2–2.5px + underline-полоса 56px.
- Базовый текст 13.5–14.5px, line-height 1.7–1.75.

### Ритм и отступы
- Модуль 8px: паддинги 24/32/40/48; между секциями 30px + 8px снизу.
- Hairline-линии 1–3px вместо жирных бордеров; dotted-leader строки в info-сетке.

### Тени и градиенты
- Двухуровневая тень карточки: ambient `0 10–18px 30–50px rgba(navy,.12–.18)`.
- Шапка: linear 135° navy + radial «прожектор» золотого свечения в углу.
- Кольцо фото: conic-gradient золота (эффект полированного металла).

### Компоненты
- Pill-метаданные: border 1px rgba(gold,.55), фон rgba(white,.06), radius 999px.
- Таблица: тёмный thead (navy→navy2), zebra even `#f7f9fc`, td padding 10×12, vessel name bold navy, type muted, rank gold-dark.
- Сертификаты: grid 2 колонки, карточки с левой gold-полосой, «Valid until» справа.
- Футер: steel rope — repeating-linear-gradient 115° со светлотными полосами + inset-блики + end-cap'ы-«скобы»; текст footer serif, letter-spacing 1.5px.

### Печать
- `@media print`: shadow off, max-width 100%, уменьшенные паддинги, `-webkit-print-color-adjust: exact`.

---

## 3. Три премиальные палитры

Токены — в `design-tokens.json`, переменные — в `premium.css`:

1. **Navy Gold** (дефолт проекта): deep navy + polished gold + white paper.
2. **Black Champagne**: near-black charcoal + champagne (#D9BE8C) + warm ivory.
3. **Ocean Platinum**: slate-ocean blue-grey + platinum silver (#C6CBD4) + cool mist.

Переключение: `<html data-theme="black-champagne">` или `data-theme="ocean-platinum"`.
