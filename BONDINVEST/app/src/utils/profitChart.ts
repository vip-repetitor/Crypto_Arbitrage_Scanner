/**
 * profitChart.ts — математика интерактивного графика прибыли.
 *
 * Строит помесячную траекторию накопленного дохода (₽) на горизонтах
 * 1/3/5/10 лет в двух режимах:
 *   - simple:   доход каждый год считается от исходной базы (без реинвеста);
 *   - compound: доход капитализируется — база растёт (сложный процент).
 *
 * Ключевая идея UI: «максимальная прибыль» = кривая compound при максимальном
 * индексе участия 1.3 (все пороги закрыты), «текущая прибыль» = кривая
 * compound при живом totalIndex из React Query. Разница между ними — это
 * наглядный «потерянный потенциал»: сколько ₽/мес пользователь недополучает,
 * пока цели не разблокированы.
 *
 * Все функции чистые и синхронные — их легко тестировать и вызывать из useMemo.
 */
import { MAX_PARTICIPATION_INDEX } from '../types';
import { annualBonusRub } from './compound';

/** Горизонты, доступные пользователю на графике (в годах). */
export const CHART_HORIZONS = [1, 3, 5, 10] as const;
export type ChartHorizon = (typeof CHART_HORIZONS)[number];

export interface ProfitPoint {
  /** Номер месяца с нуля (0 = старт, сумма 0) */
  month: number;
  /** Накопленный доход к концу месяца (₽) */
  value: number;
}

export interface ProfitSeries {
  /** Название серии для легенды */
  label: string;
  points: ProfitPoint[];
}

/**
 * Помесячная траектория накопленного дохода.
 *
 * Логика расчёта: годовой бонус (annualBonusRub от индекса) делится на 12
 * равномерных месячных начислений. В режиме compound остаток каждого месяца
 * прибавляется к базе, и следующий месяц считается от увеличенной суммы —
 * так капитализация видна помесечно, а не только по годам.
 *
 * @param index индекс участия (0..1.3) — определяет годовую ставку бонуса
 * @param principal база в рублях (по умолчанию демо-база 100 000 ₽)
 * @param years горизонт в годах
 * @param compound режим капитализации (true — сложный процент)
 */
export function monthlyProfitPath(
  index: number,
  principal = 100_000,
  years: number,
  compound = true,
): ProfitPoint[] {
  const months = Math.max(0, Math.round(years * 12));
  const ratePerMonth = annualBonusRub(index) / principal / 12; // доля ставки за месяц
  const points: ProfitPoint[] = [{ month: 0, value: 0 }];
  let base = principal;
  let accumulated = 0;
  for (let m = 1; m <= months; m++) {
    // Доход месяца считается от текущей базы (в compound она растёт каждый месяц)
    const income = base * ratePerMonth;
    accumulated += income;
    if (compound) base += income; // реинвест: доход остаётся в работе
    points.push({ month: m, value: accumulated });
  }
  return points;
}

/**
 * Полный набор серий для одной точки данных графика.
 * Возвращает 4 линии: текущий индекс (простой/сложный) и максимум 1.3
 * (простой/сложный). Сортировка массива значений — по возрастанию месяцев.
 */
export function buildProfitSeries(
  currentIndex: number,
  principal: number,
  horizonYears: ChartHorizon,
): ProfitSeries[] {
  return [
    {
      label: 'Текущая (с реинвестом)',
      points: monthlyProfitPath(currentIndex, principal, horizonYears, true),
    },
    {
      label: 'Без реинвеста',
      points: monthlyProfitPath(currentIndex, principal, horizonYears, false),
    },
    {
      label: `Максимум ${MAX_PARTICIPATION_INDEX} (с реинвестом)`,
      points: monthlyProfitPath(MAX_PARTICIPATION_INDEX, principal, horizonYears, true),
    },
  ];
}

/**
 * SVG-полилин для заданной серии.
 * Координаты нормализуются в видовое окно viewBox (w × h) с небольшим отступом,
 * чтобы линия не упиралась в рамку. Ось Y инвертирована (в SVG y растёт вниз).
 * Максимум по всем сериям передаётся снаружи — так линии сравнимы между собой.
 */
export function toPolyline(points: ProfitPoint[], w: number, h: number, maxY: number): string {
  const pad = 6;
  const spanX = Math.max(1, points[points.length - 1]?.month ?? 1);
  const safeMaxY = Math.max(maxY, 1e-9);
  return points
    .map((p) => {
      const x = pad + (p.month / spanX) * (w - pad * 2);
      const y = h - pad - (p.value / safeMaxY) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Форматирует значение ₽ компактно для подписей оси/tooltips:
 * 1234 → «1 234 ₽», 12 500 → «12,5 тыс ₽», 1 250 000 → «1,25 млн ₽».
 */
export function formatProfitTick(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${trimZero(value / 1_000_000)} млн ₽`;
  if (Math.abs(value) >= 1_000) return `${trimZero(value / 1_000)} тыс ₽`;
  return `${Math.round(value)} ₽`;
}

function trimZero(n: number): string {
  return n.toFixed(Math.abs(n) < 10 ? 1 : 0).replace(/\.0$/, '');
}
