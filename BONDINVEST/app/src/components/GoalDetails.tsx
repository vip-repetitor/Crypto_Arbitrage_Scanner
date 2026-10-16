import { Link, useParams } from 'react-router-dom';
import type { Goal, ProgressBarColor } from '../types';
import { INDEX_TO_RUB } from '../types';
import { useGoal } from '../hooks/useGoals';
import { achievedThreshold, nextThreshold, remainingToTarget } from '../utils/calculations';
import { formatRub, formatWithUnit } from '../utils/format';
import { ProgressBar } from './ProgressBar';

const GOAL_COLORS: Record<string, ProgressBarColor> = {
  loyalty: 'gold',
  volume: 'success',
  activity: 'brand',
};

interface GoalDetailsProps {
  /** Цель можно передать напрямую (тесты) или получить из роута /goal/:id */
  goal?: Goal | null;
}

/** GoalDetails — страница деталей цели (/goal/:id) */
export function GoalDetails({ goal: goalProp }: GoalDetailsProps) {
  const params = useParams<{ id: string }>();
  const { goal: routedGoal, isLoading, error } = useGoal(goalProp?.id ?? params.id);
  const data = goalProp ?? routedGoal;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <p className="text-base text-muted">Загрузка цели…</p>
      </div>
    );
  }
  if (error) {
    return <p className="text-danger">Не удалось загрузить цель.</p>;
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <p className="text-lg text-muted">Цель не найдена.</p>
        <Link to="/" className="mt-2 inline-block font-semibold text-brand hover:underline">
          ← Назад к дашборду
        </Link>
      </div>
    );
  }
  

  const color = GOAL_COLORS[data.id] ?? 'brand';
  const currentLevel = achievedThreshold(data.thresholds, data.current);
  const next = nextThreshold(data.thresholds, data.current);
  const remaining = next ? Math.max(0, next.value - data.current) : 0;
  const expectedRub = currentLevel
    ? Math.round(currentLevel.bonus * INDEX_TO_RUB * 10) / 10
    : 0;

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

      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="text-4xl">
          {data.icon}
        </span>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{data.title.toUpperCase()}</h1>
      </header>

      <section
        aria-label="Ваш прогресс"
        className="rounded-2xl border border-line bg-white p-6 shadow-card"
      >
        <h2 className="mb-3 text-lg font-semibold text-ink">Ваш прогресс</h2>
        <ProgressBar
          current={data.current}
          target={next ? next.value : data.target}
          color={color}
          status={data.status}
          size="lg"
          label={`${formatWithUnit(data.current, data.unit)} / ${formatWithUnit(
            next ? next.value : data.target,
            data.unit,
          )}`}
          ariaLabel={`Прогресс цели ${data.title}`}
        />
        <p className="mt-3 text-base text-muted">
          {remaining > 0
            ? `Осталось: ${formatWithUnit(remaining, data.unit)} до разблокировки`
            : data.hint}
        </p>
      </section>

      <section
        aria-label="Условия"
        className="rounded-2xl border border-line bg-white p-6 shadow-card"
      >
        <h2 className="mb-3 text-lg font-semibold text-ink">Условия</h2>
        <p className="mb-2 text-base text-muted">{data.description}</p>
        <ul className="space-y-2">
          {data.thresholds.map((t) => {
            const done = data.current >= t.value;
            return (
              <li key={t.value} className="flex items-center justify-between gap-3 text-base">
                <span className="tabular-nums text-ink">
                  Порог: {formatWithUnit(t.value, data.unit)} → +{t.bonus} к индексу
                </span>
                <span className={done ? 'font-semibold text-success' : 'text-muted'}>
                  {done ? '✓ достигнуто' : 'ожидается'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-label="Ваш бонус"
        className="rounded-2xl border border-gold/40 bg-gold-soft p-6 shadow-card"
      >
        <h2 className="mb-3 text-lg font-semibold text-ink">Ваш бонус</h2>
        <dl className="space-y-1 text-base">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Текущий:</dt>
            <dd className="font-bold tabular-nums text-ink">
              {currentLevel ? `+${currentLevel.bonus} к индексу` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Ожидаемая выплата:</dt>
            <dd className="font-bold tabular-nums text-gold">~{formatRub(expectedRub)}/год</dd>
          </div>
          {next && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">После {formatWithUnit(next.value, data.unit)}:</dt>
              <dd className="font-bold tabular-nums text-ink">
                +{next.bonus} (+{formatRub(Math.round(next.bonus * INDEX_TO_RUB * 10) / 10)})
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section
        aria-label="Как достичь цели"
        className="rounded-2xl border border-line bg-white p-6 shadow-card"
      >
        <h2 className="mb-3 text-lg font-semibold text-ink">Как достичь цели</h2>
        <ol className="list-inside list-decimal space-y-2 text-base text-muted">
          {data.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {next && (
        <section
          aria-label="Следующий уровень"
          className="rounded-2xl border border-brand/30 bg-brand-soft p-6 shadow-card"
        >
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-ink">
            💎 Следующий уровень
          </h2>
          <p className="text-base text-ink">
            Порог: {formatWithUnit(next.value, data.unit)} → +{next.bonus} к индексу
          </p>
          <p className="mt-1 text-base text-muted">
            Осталось: {formatWithUnit(remainingToTarget({ current: data.current, target: next.value }), data.unit)}
          </p>
        </section>
      )}

      <button
        type="button"
        className="w-full rounded-xl bg-brand px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        Пополнить сейчас
      </button>
    </div>
  );
}
