# ✅ Чек-лист реализации проекта BONDINVEST

Пошаговый план реализации + результаты проверки каждого пункта.
Проверка выполнена: 2026-10-16, на основе фактического кода в `BONDINVEST/app/`,
`npx tsc --noEmit`, `npm run build`, `npm test` (vitest + axe-core).

Легенда: `[x]` — выполнено и проверено · `[ ]` — не выполнено

---

## Шаг 1. Технический стек и scaffold проекта

- [x] React 18 (`react ^18.3.1`)
- [x] TypeScript (`typescript ^5.9.3`, все компоненты типизированы)
- [x] Vite (`vite ^5.4.21`, `npm run dev/build` работают)
- [x] TailwindCSS (`tailwindcss ^3.4.19` + postcss + `tailwind.config.js`)
- [x] Framer Motion (`framer-motion ^11.18.2`)
- [x] React Query (`@tanstack/react-query ^5.104.3`, QueryProvider в `main.tsx`)
- [x] React Router (`react-router-dom ^6.30.6`)
- [x] Vitest + Testing Library + axe-core для тестов

**Проверка:** `npm run build` → ✓ built in 5.67s (448 modules). ✅

## Шаг 2. Структура проекта

- [x] `src/components/ProgressBar.tsx`
- [x] `src/components/GoalCard.tsx`
- [x] `src/components/Dashboard.tsx`
- [x] `src/components/GoalDetails.tsx`
- [x] `src/components/AchievementToast.tsx`
- [x] `src/components/TransactionRow.tsx`
- [x] `src/hooks/useGoals.ts`
- [x] `src/hooks/useAnimations.ts`
- [x] `src/utils/format.ts`
- [x] `src/utils/calculations.ts`
- [x] Дополнительно: `HistoryPage.tsx`, `mockData.ts`, `types.ts`, `__tests__/`

**Проверка:** `find src -type f` — все файлы из ТЗ присутствуют. ✅

## Шаг 3. Данные и бизнес-логика

- [x] Мок-данные точно из ТЗ (`totalIndex: 0.6`, 3 цели, транзакции) — `utils/mockData.ts`
- [x] Пороги целей: Лояльность 8/20 нед (+0.3/+0.5), Объём 2000/5000₽ (+0.2/+0.4), Активность 3/6 (+0.2/+0.3)
- [x] Загрузка данных через React Query (`useGoals`, `useTransactions`) с имитацией латентности
- [x] Расчёты прогресса/остатка/уровней вынесены в `calculations.ts` и покрыты юнит-тестами

## Шаг 4. Компонент ProgressBar

- [x] Пропсы: `current`, `target`, `color`, `status`
- [x] Состояния: Empty / In Progress / Achieved / Locked
- [x] Анимация заполнения 600ms ease-out (`transition={{ duration: 0.6, ease: 'easeOut' }}`)
- [x] ARIA: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`
- [x] Ограничение процента при перевыполнении (тест «процент ограничен 100»)

## Шаг 5. Компонент GoalCard

- [x] Пропсы: `title`, `icon`, `progress`, `bonus`, `status`, `hint`
- [x] Статусы: ✓ Разблокировано / 🔄 В процессе / 🔒 Заблокировано
- [x] Подсказки «Осталось X» / «До следующего уровня»
- [x] Клик → детали цели; клавиатура: Enter/Space (`onKeyDown`, `role="button"`, `tabIndex`)
- [x] Hover: поднятие + тень (`hover:shadow-card-hover`, 200ms)
- [x] Пульсация целей >80% (`shouldPulse` + `animate-pulseGlow`)

## Шаг 6. Компонент Dashboard

- [x] Карточка общего индекса (шкала 0.0–1.3, уровни Low/Medium/High) — IndexScore
- [x] Три карточки целей
- [x] Ожидаемый бонус в рублях
- [x] История транзакций (последние 5) + кнопка «Смотреть все»
- [x] Счётчик числа индекса от 0 до значения (useCountUp, 800ms)
- [x] Приветствие пользователя («Привет, Иван!»)

## Шаг 7. Компонент GoalDetails

- [x] Крупный прогресс-бар
- [x] Условия (пороги с бонусами)
- [x] Текущий и ожидаемый бонус (₽/год)
- [x] Пошаговая инструкция «Как достичь цели»
- [x] Следующий уровень (если есть) — блок «💎 Следующий уровень»
- [x] CTA «Пополнить сейчас», кнопка «← Назад»

## Шаг 8. Компонент AchievementToast

- [x] Всплывающее уведомление при достижении порога
- [x] Конфетти: 100 частиц (`CONFETTI_COUNT = 100`), цвета зелёный/золотой (+синий)
- [x] Звук успеха опционально (`playSuccessChime` через WebAudio, `soundEnabled`)
- [x] Длительность показа 2 секунды (`setTimeout(onDismiss, 2000)`)
- [x] Масштабирование иконки 1.0 → 1.2 → 1.0 (`iconPop`)
- [x] Появление снизу (y: 48 → 0), `role="alert"` для скринридеров

## Шаг 9. TransactionRow / BonusBadge / IndexScore

- [x] TransactionRow: состояния Deposit 📥 / Withdraw 📤 / Bonus 💎
- [x] Суммы: зелёные +, красные −, `tabular-nums`
- [x] Относительные даты («Сегодня 14:30», «Вчера»)
- [x] BonusBadge — отображение бонуса (+0.2/+0.3) на карточке цели
- [x] IndexScore — карточка индекса с градацией Low (<0.3) / Medium (0.3–0.7) / High (>0.7)

## Шаг 10. Роутинг

- [x] `/` → Дашборд
- [x] `/goal/:id` → Детали цели
- [x] `/history` → История бонусов (фильтры Все/Лояльность/Объём/Активность/Выводы + экспорт CSV)
- [x] Маршрут-заглушка `*` (404)

## Шаг 11. Дизайн-система

- [x] Цвета ТЗ в `tailwind.config.js`: brand #2563EB, success #16A34A, gold #CA8A04, ink #0F172A, muted #475569, line #CBD5E1, surface #F8FAFC (+ hover/soft варианты, red #DC2626)
- [x] Шрифт Inter (font-family в CSS + tailwind config)
- [x] Типографика: крупные цифры 28–36px weight 700 tabular-nums; заголовки 600; текст 400
- [x] `.tabular-nums` класс (`font-variant-numeric: tabular-nums`)

## Шаг 12. Микровзаимодействия

- [x] Прогресс-бары: 600ms ease-out
- [x] Карточки: hover поднятие + тень (200ms)
- [x] Достижение порога: конфетти + звук
- [x] Пульсация целей >80% (1000ms loop)
- [x] Число индекса: счётчик 800ms
- [x] Уведомление: всплытие снизу (~400ms spring)

## Шаг 13. Доступность

- [x] Контраст ≥ 4.5:1 (slate-палитра на белом/surface фоне)
- [x] Навигация с клавиатуры: Tab + focus-visible ring на всех интерактивных элементах
- [x] ARIA у прогресс-баров (valuenow/min/max/valuetext)
- [x] Иконки + текст (не только цвет) для статусов и типов транзакций
- [x] Озвучка прогресса через `aria-valuetext` («Прогресс 75%…»)
- [x] `prefers-reduced-motion` уважается (index.css)
- [x] Тесты доступности axe-core проходят

## Шаг 14. Тестирование

- [x] Юнит-тесты ProgressBar (4 теста, включая axe)
- [x] Юнит-тесты GoalCard (5 тестов, включая клавиатуру и axe)
- [x] Юнит-тесты utils/format/calculations (10 тестов)
- [x] Тесты доступности (axe-core) ✅ проходят
- [ ] Визуальные регрессии — опциональны по ТЗ, не реализованы ⚠️

**Итог прогона:** `npm test` → Test Files 2 passed, **Tests 19 passed (19)** ✅

## Шаг 15. Финальная верификация

- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешная production-сборка
- [x] `npm test` — все тесты зелёные
- [x] Изменения закоммичены в git
