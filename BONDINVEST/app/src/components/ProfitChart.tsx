/**
 * ProfitChart.tsx — интерактивный график прибыли на странице пользователя.
 *
 * Что показывает (по финансовой модели проекта):
 *  - «Максимальная прибыль» — накопленный доход при индексе 1.3 (все цели закрыты)
 *    с реинвестированием (сложный процент) — верхняя золотая граница графика;
 *  - «Текущая прибыль» — та же траектория, но от ЖИВОГО totalIndex из React Query:
 *    линия перерисовывается в реальном времени после каждого действия симулятора;
 *  - «Без реинвеста» — простая линия для对比: видно, сколько даёт капитализация.
 *
 * Интерактивность (геймификационные паттерны казино/премиум-банков):
 *  - переключатель горизонта 1/3/5/10 лет (сегменты, aria-pressed);
 *  - слайдер суммы базы — пользователь «примеряет» модель на свои деньги;
 *  - hover/touch по графику — вертикальный курсор + tooltip с точными ₽ всех линий;
 *  - анимация «прорисовки» линии через pathLength 0→1 (framer-motion) при смене данных;
 *  - KPI-строка сверху: текущий доход vs максимум и «недополученный потенциал» ₽/мес.
 *
 * Рендер — чистый SVG (без тяжёлых чарт-библиотек): точки считаются useMemo,
 * линии — polyline. Доступность: role="img" + aria-label со сводкой цифр,
 * все контролы — нативные кнопки/input доступны с клавиатуры.
 */
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChartHorizon, ProfitSeries } from '../utils/profitChart';
import {
  CHART_HORIZONS,
  buildProfitSeries,
  formatProfitTick,
  toPolyline,
} from '../utils/profitChart';
import { MAX_PARTICIPATION_INDEX } from '../types';
import { annualBonusRub } from '../utils/compound';
import { formatRub } from '../utils/format';

/** Цвета серий: зелёный = живая прибыль, слейт = без реинвеста, золото = максимум. */
const SERIES_COLORS = ['#16A34A', '#94A3B8', '#CA8A04'];
const SERIES_DASH = ['', '6 4', ''];

/** Видовое окно SVG-графика (координаты нормализуются под него). */
const W = 560;
const H = 220;

export function ProfitChart({ currentIndex }: { currentIndex: number }) {
  // Состояния интерактива: горизонт, сумма базы, активный месяц (hover)
  const [horizon, setHorizon] = useState<ChartHorizon>(3);
  const [principal, setPrincipal] = useState(100_000);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * Пересчёт серий только при изменении входа (useMemo) — график дешёвый,
   * но при автосимуляции (шаг каждые 250мс) лишние рендеры дорого стоят.
   */
  const series: ProfitSeries[] = useMemo(
    () => buildProfitSeries(currentIndex, principal, horizon),
    [currentIndex, principal, horizon],
  );

  // Максимум по всем сериям — общая шкала Y, чтобы линии были сравнимы
  const maxY = useMemo(
    () => Math.max(...series.flatMap((s) => s.points.map((p) => p.value))),
    [series],
  );

  // KPI-строка: ₽/год сейчас, ₽/год на максимуме, недополученный потенциал
  const nowPerYear = annualBonusRub(currentIndex);
  const maxPerYear = annualBonusRub(MAX_PARTICIPATION_INDEX);
  const gapPerMonth = Math.max(0, (maxPerYear - nowPerYear) / 12);

  /**
   * Перевод координаты курсора в номер месяца: берём X относительно viewBox,
   * нормализуем в долю ширины и умножаем на количество месяцев горизонта.
   * Квантуем до целого месяца — точки данных именно целочисленные.
   */
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverMonth(Math.round(frac * horizon * 12));
  };

  /** Значение серии в месяце m (траектории монотонны, индекс = месяц). */
  const valueAt = (s: ProfitSeries, m: number) =>
    s.points[Math.min(m, s.points.length - 1)].value;

  // Позиция вертикального курсора hover в координатах viewBox
  const cursorX =
    hoverMonth === null
      ? null
      : 6 + (hoverMonth / (horizon * 12)) * (W - 12);

  return (
    <section
      aria-labelledby="profit-chart-title"
      className="rounded-3xl bg-white p-5 shadow-premium ring-1 ring-slate-100 sm:p-6"
    >
      {/* ── Заголовок + KPI ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="profit-chart-title" className="text-xl font-semibold text-slate-900">
            📈 График вашей прибыли
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Текущая против максимальной — с учётом сложного процента по нашей модели
          </p>
        </div>
        <dl className="flex gap-4 text-right">
          <div>
            <dt className="sr-only">Доход сейчас, ₽/год</dt>
            <dd className="text-lg font-bold tabular-nums text-success">
              +{formatRub(nowPerYear)}
            </dd>
            <dd className="text-xs text-slate-600">сейчас / год</dd>
          </div>
          <div>
            <dt className="sr-only">Максимальный доход, ₽/год</dt>
            <dd className="text-lg font-bold tabular-nums text-gold">
              +{formatRub(maxPerYear)}
            </dd>
            <dd className="text-xs text-slate-600">максимум / год</dd>
          </div>
        </dl>
      </div>

      {/* ── Контролы: горизонт + слайдер суммы ──────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Сегментированный переключатель горизонта (казино-приём: крупные тапы) */}
        <div role="group" aria-label="Горизонт прогноза" className="flex rounded-xl bg-slate-100 p-1">
          {CHART_HORIZONS.map((yrs) => (
            <button
              key={yrs}
              type="button"
              onClick={() => setHorizon(yrs)}
              aria-pressed={horizon === yrs}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand ${
                horizon === yrs ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {yrs} {yrs === 1 ? 'год' : yrs < 5 ? 'года' : 'лет'}
            </button>
          ))}
        </div>

        {/* Слайдер базы: «примерь модель на свои деньги» */}
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-sm text-slate-600">
          <span className="whitespace-nowrap">База:</span>
          <input
            type="range"
            min={10_000}
            max={1_000_000}
            step={10_000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            aria-label="Сумма инвестиций в рублях"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand"
          />
          <output className="w-24 text-right font-semibold tabular-nums text-slate-900">
            {formatRub(principal)}
          </output>
        </label>
      </div>

      {/* ── SVG-график ──────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`График накопленного дохода за ${horizon} года при базе ${formatRub(principal)}: текущая линия ${formatRub(
            valueAt(series[0], horizon * 12),
          )}, максимальная ${formatRub(valueAt(series[2], horizon * 12))}`}
          className="w-full touch-none select-none"
          onPointerMove={handlePointer}
          onPointerLeave={() => setHoverMonth(null)}
        >
          {/* Горизонтальные грид-линии + подписи оси Y (₽) */}
          {[0.25, 0.5, 0.75, 1].map((f) => {
            const y = H - 6 - f * (H - 12);
            return (
              <g key={f}>
                <line x1={6} x2={W - 6} y1={y} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                <text x={W - 8} y={y - 3} textAnchor="end" fontSize={10} fill="#94A3B8">
                  {formatProfitTick(maxY * f)}
                </text>
              </g>
            );
          })}

          {/* Линии серий: key включает вход — при смене данных линия «прорисовывается» заново */}
          {series.map((s, i) => (
            <motion.polyline
              key={`${horizon}-${principal}-${currentIndex}-${i}`}
              fill="none"
              stroke={SERIES_COLORS[i]}
              strokeWidth={i === 2 ? 2.5 : 2}
              strokeDasharray={SERIES_DASH[i] || undefined}
              strokeLinecap="round"
              points={toPolyline(s.points, W, H, maxY)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}

          {/* Область под текущей линией — мягкий зелёный градиент (эффект «роста капитала») */}
          <polygon
            points={`6,${H - 6} ${toPolyline(series[0].points, W, H, maxY)} ${W - 6},${H - 6}`}
            fill="url(#areaGrad)"
          />
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Вертикальный курсор hover + точки на всех линиях */}
          {cursorX !== null && hoverMonth !== null && (
            <g>
              <line x1={cursorX} x2={cursorX} y1={6} y2={H - 6} stroke="#CBD5E1" strokeWidth={1} strokeDasharray="4 3" />
              {series.map((s, i) => (
                <circle
                  key={i}
                  cx={cursorX}
                  cy={H - 6 - (valueAt(s, hoverMonth) / Math.max(maxY, 1e-9)) * (H - 12)}
                  r={4}
                  fill="white"
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Tooltip: выводим HTML-блоком поверх SVG — проще стилизовать и доступнее */}
        {hoverMonth !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
            style={{ left: `${Math.min(78, (hoverMonth / (horizon * 12)) * 100)}%` }}
            role="status"
          >
            <div className="mb-1 font-semibold">
              {hoverMonth === 0 ? 'Старт' : `${Math.floor(hoverMonth / 12)} мес.`}
            </div>
            {series.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 tabular-nums">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                <span className="text-slate-300">{s.label}:</span>
                <span className="font-semibold">{formatProfitTick(valueAt(s, hoverMonth))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Легенда + мотивационная плашка «потери» ─────────────────── */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600" aria-label="Легенда графика">
        {series.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: SERIES_COLORS[i], opacity: SERIES_DASH[i] ? 0.6 : 1 }}
            />
            {s.label}
          </li>
        ))}
      </ul>

      {gapPerMonth > 0.05 && (
        <p className="mt-3 rounded-xl bg-gold-soft px-4 py-3 text-sm text-slate-900">
          💎 Закройте оставшиеся цели до индекса {MAX_PARTICIPATION_INDEX} — и ваш доход вырастет ещё на{' '}
          <strong className="tabular-nums">{formatRub(gapPerMonth)}/мес</strong> с эффектом сложного процента.
        </p>
      )}
    </section>
  );
}
