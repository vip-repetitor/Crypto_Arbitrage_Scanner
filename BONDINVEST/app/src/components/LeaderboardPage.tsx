/**
 * LeaderboardPage.tsx — страница «Статистика и лидерборд» (роут /leaderboard).
 *
 * Логика работы:
 * 1. Данные текущего пользователя берутся из React Query-кэша ['dashboard']
 *    (тот же источник, что у Dashboard) — при активной симуляции лидерборд
 *    «живой»: место «Вы» пересчитывается на каждом шаге без рефетча.
 * 2. generateLeaderboard() детерминированно строит выборку из 40 пользователей
 *    + строка «Вы»; aggregateStats() даёт карточки сводной статистики.
 * 3. Сортировка таблицы по клику на заголовки колонок (name/index/yield/rub):
 *    состояние sortKey/sortDir локальное; сравнение стабильное, численные
 *    колонки — убывание по умолчанию (больше = лучше для финансово метрики).
 * 4. Топ-3 получают медали 🥇🥈🥉 — визуальный якорь сверх цвета (a11y).
 * 5. Строка «Вы» подсвечивается золотым фоном; если её нет в видимых 15 —
 *    показывается отдельная «sticky»-строка с вашим местом внизу таблицы.
 * 6. Анимация появления строк через framer-motion stagger (по ТЗ-таймингам);
 *    prefers-reduced-motion отключает анимацию глобальным CSS-правилом.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardData } from '../types';
import {
  generateLeaderboard,
  aggregateStats,
  type LeaderRow,
} from '../utils/leaderboard';
import { formatRub, formatIndex } from '../utils/format';

/** Ключи сортируемых колонок: всё, что имеет численный/текстовый смысл. */
type SortKey = 'rank' | 'name' | 'index' | 'yieldPct' | 'yearlyRub';

/** Компаратор колонок: текст — localeCompare('ru'), числа — разность. */
function compareRows(a: LeaderRow, b: LeaderRow, key: SortKey, dir: 1 | -1): number {
  if (key === 'name') return a.name.localeCompare(b.name, 'ru') * dir;
  return ((a[key] as number) - (b[key] as number)) * dir;
}

export function LeaderboardPage() {
  // Читаем кэш дашборда напрямую: данные уже загружены на '/', повторный
  // запрос не нужен — это тот же паттерн, что у GoalDetails (useGoals).
  const qc = useQueryClient();
  const dash = qc.getQueryData<DashboardData>(['dashboard']);

  // Локальное состояние сортировки (не синхронизируем с URL — MVP)
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  /**
   * useMemo пересобирает выборку только при изменении индекса/депозита «меня»
   * (или ручном refetch). seed фиксирован → соседние строки не «прыгают».
   */
  const rows = useMemo(
    () =>
      generateLeaderboard(
        40,
        20250115,
        dash?.totalIndex,
        // Депозит «меня» выводим из цели «Объём» (current = средний депозит)
        dash?.goals.find((g) => g.id === 'volume')?.current,
      ),
    [dash?.totalIndex, dash?.goals],
  );

  const stats = useMemo(() => aggregateStats(rows), [rows]);
  const me = rows.find((r) => r.isMe);

  /** Отсортированная копия для рендера (исходный массив рангов не мутируем). */
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  /** Клик по заголовку: та же колонка — инверсия направления, иначе — новый ключ. */
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 1 : -1); // для чисел «лучше сверху»
    }
  };

  /** Маркер сортировки в заголовке (стрелка + aria-sort для скринридера). */
  // align — полный класс Tailwind (не интерполяция `text-${align}`): динамические
  // имена классов не детектируются контент-сканером и не попадают в сборку.
  const th = (key: SortKey, label: string, alignClass = 'text-right') => (
    <th
      scope="col"
      aria-sort={sortKey === key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 ${alignClass} font-semibold text-muted`}
    >
      <button
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 hover:text-brand transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded"
      >
        {label}
        <span aria-hidden>{sortKey === key ? (sortDir === 1 ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );

  /** Медаль для топ-3 по исходному рангу (не зависит от текущей сортировки). */
  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Хлебные крошки как на остальных страницах — единая навигация */}
      <nav aria-label="Хлебные крошки">
        <Link to="/" className="text-brand hover:underline text-sm font-medium">
          ← Назад на дашборд
        </Link>
      </nav>

      <h1 className="mt-4 text-[28px] font-bold text-ink tabular-nums">
        📊 Статистика и лидерборд
      </h1>
      <p className="mt-1 text-muted">
        Доходности всех участников программы: три цели — три бонуса — до 10% годовых.
      </p>

      {/* ── Карточки сводной статистики (агрегаты по всей выборке) ── */}
      <section aria-label="Сводная статистика" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Участников', value: String(stats.users), hint: 'в программе' },
          { label: 'Средняя доходность', value: `${stats.avgYieldPct}%`, hint: 'годовых' },
          { label: 'Лучшая ставка', value: `${stats.topYieldPct}%`, hint: 'гарантированные 4% + премия за индекс (до 13.75% при максимуме 1.3)' },
          { label: 'Выплаты всем', value: formatRub(stats.totalYearlyRub), hint: 'в год' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="text-sm text-muted">{c.label}</div>
            <div className="mt-1 text-[22px] font-bold text-ink tabular-nums">{c.value}</div>
            <div className="text-xs text-muted">{c.hint}</div>
          </div>
        ))}
      </section>

      {/* ── Позиция текущего пользователя крупно ── */}
      {me && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border-2 border-gold bg-gold-soft p-4"
          role="status"
        >
          <span className="text-2xl" aria-hidden>{me.avatar}</span>
          <span className="font-semibold text-ink">Ваше место: #{me.rank} из {stats.users}</span>
          <span className="tabular-nums text-muted">Индекс {formatIndex(me.index)}</span>
          <span className="tabular-nums text-muted">{me.yieldPct}% годовых</span>
          <span className="tabular-nums font-bold text-ink">{formatRub(me.yearlyRub)}/год</span>
        </motion.div>
      )}

      {/* ── Таблица лидерборда ── */}
      <section aria-label="Рейтинг участников" className="mt-6 overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Рейтинг участников программы по годовой доходности; сортировка доступна кнопками в заголовках
          </caption>
          <thead className="border-b border-line bg-surface">
            <tr>
              {th('rank', '#', 'text-left')}
              {th('name', 'Участник', 'text-left')}
              {th('index', 'Индекс')}
              {th('yieldPct', 'Доходность')}
              {th('yearlyRub', '₽/год')}
              <th scope="col" className="px-3 py-2 text-right font-semibold text-muted">Цели</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <motion.tr
                key={`${r.name}-${r.rank}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.5) }}
                className={[
                  'border-b border-line/40 last:border-0',
                  r.isMe ? 'bg-gold-soft font-semibold' : 'hover:bg-surface',
                ].join(' ')}
              >
                <td className="px-3 py-2 text-left tabular-nums text-muted">
                  {medal(r.rank) ?? r.rank}
                </td>
                <td className="px-3 py-2 text-left">
                  <span aria-hidden className="mr-2">{r.avatar}</span>
                  {r.name}
                  {r.isMe && <span className="ml-2 rounded bg-brand px-1.5 py-0.5 text-xs font-semibold text-white">это вы</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatIndex(r.index)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {/* Цвет + число: не полагаемся только на цвет (a11y) */}
                  <span className={r.yieldPct >= 8 ? 'text-success' : 'text-ink'}>{r.yieldPct}%</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRub(r.yearlyRub)}</td>
                <td className="px-3 py-2 text-right" aria-label={`${r.goalsAchieved} из 3 целей`}>
                  {'✓'.repeat(r.goalsAchieved) || '—'}
                  <span className="text-muted">{'·'.repeat(Math.max(0, 3 - r.goalsAchieved))}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs text-muted">
        * Демо-выборка сгенерирована детерминированно по модели выплат проекта
        (index = 0.1 + Бₗояльность + Бₒбъём + Бₐктивность; доходность = 4% ОФЗ + премия за индекс).
      </p>
    </div>
  );
}
