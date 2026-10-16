/**
 * CalcPage.tsx — публичная SEO-страница «Калькулятор сложного процента» (роут /calc).
 *
 * Маркетинговая логика (tool page):
 * - Это единственная страница, доступная БЕЗ авторизации и без мок-данных профиля:
 *   поисковик индексирует её как самостоятельный ответ на запрос
 *   «калькулятор сложного процента», «сколько принесёт 100000 рублей».
 * - Вверху — H1 с ключом + LLM-friendly текст-объяснение формулы (поисковые
 *   системы и AI-ассистенты извлекают ответ прямо из текста).
 * - Внизу — воронка: результат расчёта конвертируется в CTA «Открыть BONDINVEST»,
 *   поскольку калькулятор показывает лишь базу, а бонусы за цели (+0.2…+0.5)
 *   доступны только пользователям продукта.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/useSeo';
import { CALC_META } from '../utils/seo';
import { INDEX_TO_RUB } from '../types';
import { projectCompound, type CompoundYearRow } from '../utils/compound';
import { formatRub } from '../utils/format';

/** Годовая ставка по умолчанию = гарантия 4% (база продукта без бонусов). */
const DEFAULT_RATE_PCT = 4;
const MIN_RATE = 1;
const MAX_RATE = 13.75; // потолок модели: база 4% + индекс 1.3 × 7.5 п.п.

export function CalcPage() {
  usePageMeta(CALC_META);

  // Состояние калькулятора: сумма, ставка, горизонт — всё живое, без моков профиля
  const [principal, setPrincipal] = useState(100_000);
  const [ratePct, setRatePct] = useState(DEFAULT_RATE_PCT);
  const [years, setYears] = useState(5);

  /**
   * Траектория капитализации считается чистым модулем utils/compound:
   * каждый год доход начисляется на базу, увеличенную на прошлый доход.
   * useMemo — пересчёт только при изменении входов (слайдеры дёргают часто).
   */
  // projectCompound принимает индекс; обратный перевод нужной ставки в «эквивалент
  // индекса» даёт index = rate*principal / INDEX_TO_RUB — так страница-калькулятор
  // использует ЕДИНСТВЕННЫЙ источник математики (utils/compound), без дублирования формул.
  const schedule = useMemo(() => {
    const equivalentIndex = (ratePct / 100) * principal / INDEX_TO_RUB;
    return projectCompound(principal, equivalentIndex, years);
  }, [principal, ratePct, years]);

  const rows: CompoundYearRow[] = schedule.rows;
  const finalBalance = rows[rows.length - 1]?.totalEnd ?? principal;
  const totalIncome = schedule.compoundTotal;
  // Простой процент для сравнения — классический приём UX: показать «выигрыш выигрыша»
  // (simpleIncome нужен только через schedule.extra — сравнение уже посчитано)
  const compoundEdge = schedule.extra;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {/* Х1 с основным поисковым запросом; текст ниже отвечает на него напрямую */}
      <header>
        <h1 className="text-3xl font-bold text-ink">Калькулятор сложного процента</h1>
        <p className="mt-2 text-base text-muted" id="calc-formula">
          Доход за год: Сумма × Ставка. Доход на второй год: (Сумма + Доход за год 1) ×
          Ставка. Так работает сложный процент: каждый новый доход увеличивает базу для
          следующего начисления. Например, 100&nbsp;000 ₽ под 4% годовых принесёт в первый
          год 4&nbsp;000 ₽, а на второй год проценты капнут уже на 104&nbsp;000 ₽.
        </p>
      </header>

      {/* --- Панель ввода: три контрола с явными подписями (a11y: label htmlFor) --- */}
      <section aria-labelledby="calc-formula" className="rounded-3xl bg-white p-6 shadow-premium">
        <div className="grid gap-6 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Сумма, ₽</span>
            <input
              type="number"
              min={10_000}
              max={10_000_000}
              step={10_000}
              value={principal}
              onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-lg font-bold tabular-nums text-ink"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Ставка, % годовых</span>
            <input
              type="range"
              min={MIN_RATE}
              max={MAX_RATE}
              step={0.25}
              value={ratePct}
              onChange={(e) => setRatePct(Number(e.target.value))}
              className="mt-4 w-full accent-brand"
              aria-valuetext={`${ratePct}% годовых`}
            />
            <span className="text-lg font-bold tabular-nums text-success">{ratePct}%</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Срок, лет</span>
            <select
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-lg font-bold tabular-nums text-ink"
            >
              {[1, 2, 3, 5, 7, 10].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {/* --- Результат: крупные цифры tabular-nums, контрастное сравнение режимов --- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3" role="status" aria-live="polite">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-muted">Итог через {years} лет</p>
            <p className="text-2xl font-bold tabular-nums text-ink">{formatRub(finalBalance)}</p>
          </div>
          <div className="rounded-2xl bg-green-100 p-4">
            <p className="text-sm text-success">Доход (сложный %)</p>
            <p className="text-2xl font-bold tabular-nums text-success">{formatRub(totalIncome)}</p>
          </div>
          <div className="rounded-2xl bg-yellow-100 p-4">
            <p className="text-sm text-gold">Выгода против простого %</p>
            <p className="text-2xl font-bold tabular-nums text-gold">+{formatRub(compoundEdge)}</p>
          </div>
        </div>

        {/* Таблица по годам — E-E-A-T сигнал: расчёт прозрачен и проверяем */}
        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Капитализация дохода по годам</caption>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="py-2">Год</th>
              <th scope="col" className="py-2">База на начало</th>
              <th scope="col" className="py-2">Доход</th>
              <th scope="col" className="py-2">Баланс</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-line/50 tabular-nums">
                <td className="py-2 font-semibold text-ink">{row.year}</td>
                <td className="py-2 text-muted">{formatRub(row.baseStart)}</td>
                <td className="py-2 text-success">+{formatRub(row.income)}</td>
                <td className="py-2 font-semibold text-ink">{formatRub(row.totalEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* --- Воронка: конверсия инструмента в продукт --- */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-blue-700 p-6 text-white">
        <h2 className="text-xl font-semibold">Хотите ставку выше 4%?</h2>
        <p className="mt-2 text-sm text-blue-100">
          BONDINVEST — это реальные ОФЗ плюс индекс участия: держите депозит, растите объём
          и активность — и доходность вырастет до 10% годовых. Каждая надбавка остаётся в базе
          и продолжает работать по сложному проценту.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-white px-6 py-3 text-base font-semibold text-brand transition hover:scale-[1.02]"
        >
          Открыть свой индекс участия →
        </Link>
      </section>

      {/* Дисклеймер обязателен для финансовой рекламы (39-ФЗ о рекламе) */}
      <p className="text-xs text-muted">
        Расчёт носит информационный характер и не является индивидуальной инвестиционной
        рекомендацией. Доходность зависит от соблюдения правил удержания депозита.
      </p>
    </div>
  );
}
