import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TransactionType } from '../types';
import { useBonusHistory } from '../hooks/useGoals';
import { formatRub } from '../utils/format';
import { TransactionRow } from './TransactionRow';

type Filter = 'all' | 'loyalty' | 'volume' | 'activity' | 'withdraw';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'loyalty', label: 'Лояльность' },
  { id: 'volume', label: 'Объём' },
  { id: 'activity', label: 'Активность' },
  { id: 'withdraw', label: 'Выводы' },
];

function matchesFilter(type: TransactionType, label: string | undefined, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'withdraw') return type === 'withdraw';
  const l = (label ?? '').toLowerCase();
  return (
    type === 'bonus' &&
    ((filter === 'loyalty' && l.includes('лояльн')) ||
      (filter === 'volume' && l.includes('объём')) ||
      (filter === 'activity' && l.includes('активност')))
  );
}

/** Экспорт истории в CSV */
export function exportCsv(rows: Array<{ date: string; label: string; amount: number }>): void {
  const header = 'Дата;Описание;Сумма\n';
  const body = rows
    .map((r) => `${r.date};${r.label.replace(/;/g, ',')};${String(r.amount).replace('.', ',')}`)
    .join('\n');
  const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bondinvest-bonuses.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** HistoryPage — история бонусов (/history): выплаты, суммы, фильтры, экспорт */
export function HistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useBonusHistory();
  const [filter, setFilter] = useState<Filter>('all');

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <p className="text-base text-muted">Загрузка истории…</p>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-danger">Не удалось загрузить историю.</p>;
  }

  const filtered = data.filter((t) => matchesFilter(t.type, t.label, filter));
  const totalBonuses = data.filter((t) => t.type === 'bonus').reduce((s, t) => s + t.amount, 0);
  const last30 = data
    .filter((t) => t.type === 'bonus' && new Date(t.date.replace(' ', 'T')) >= new Date('2024-12-16'))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <nav aria-label="Хлебные крошки">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-base font-semibold text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          ← Назад к дашборду
        </Link>
      </nav>

      <h1 className="text-2xl font-bold text-ink sm:text-3xl">История бонусов</h1>

      <section
        aria-label="Суммарные бонусы"
        className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-6 shadow-card sm:grid-cols-2"
      >
        <div>
          <p className="text-sm text-muted">📊 Всего бонусов</p>
          <p className="text-3xl font-bold tabular-nums text-gold">{formatRub(totalBonuses)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">📅 За последние 30 дней</p>
          <p className="text-3xl font-bold tabular-nums text-ink">{formatRub(last30)}</p>
        </div>
      </section>

      <section aria-label="Фильтры">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Фильтры</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр истории">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                filter === f.id
                  ? 'bg-brand text-white'
                  : 'border border-line bg-white text-muted hover:bg-brand-soft'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section
        aria-label="Выплаты"
        className="rounded-2xl border border-line bg-white p-5 shadow-card"
      >
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-base text-muted">Нет записей по выбранному фильтру.</p>
        ) : (
          <ul>
            {filtered.map((t) => (
              <TransactionRow key={t.id} transaction={t} dateMode="full" />
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() =>
          exportCsv(
            filtered.map((t) => ({
              date: t.date,
              label: t.label ?? t.type,
              amount: t.amount,
            })),
          )
        }
        className="w-full rounded-xl border border-brand bg-white px-4 py-3 text-base font-bold text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        Экспорт в CSV
      </button>

      <p className="text-center text-sm text-muted">
        Демонстрация навигации:{' '}
        <button
          type="button"
          onClick={() => navigate('/goal/volume')}
          className="font-semibold text-brand hover:underline"
        >
          открыть цель «Объём»
        </button>
      </p>
    </div>
  );
}
