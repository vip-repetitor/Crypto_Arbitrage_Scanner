/**
 * GoalDetails.tsx — страница деталей цели (роут /goal/:id).
 * Пять секций из ТЗ: «Ваш прогресс», «Условия» (пороги), «Ваш бонус»,
 * «Как достичь» (шаги) и «Следующий уровень».
 *
 * Логика получения данных: цель ищется через useGoal(id) из кэша ['goals'].
 * Проп goal позволяет передать данные напрямую (используется в юнит-тестах
 * без роутера и React Query).
 * Порядок раннего возврата: loading → error → not found → контент;
 * после загрузки данных рендер синхронный, все вычисления — чистые функции.
 */
import { Link, useParams } from 'react-router-dom';
import type { Goal, ProgressBarColor } from '../types';
import { INDEX_TO_RUB } from '../types';
import { useGoal } from '../hooks/useGoals';
import { achievedThreshold, nextThreshold, remainingToTarget, forecastWeeks, forecastDate } from '../utils/calculations';
import { formatRub, formatWithUnit } from '../utils/format';
import { ProgressBar } from './ProgressBar';
// Контентные врезки про сложный процент: строка капитализации + мысль о уровнях
import { CompoundInsight, COMPOUND_THOUGHTS } from './CompoundInterest';

/** Те же закреплённые цвета баров, что на дашборде (макет требует консистентности). */
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
  // id берётся либо из пропа (тесты), либо из URL-параметра маршрута
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
    // 404-состояние: несуществующий id в адресной строке — ссылка назад, чтобы не тупик
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <p className="text-lg text-muted">Цель не найдена.</p>
        <Link to="/" className="mt-2 inline-block font-semibold text-brand hover:underline">
          ← Назад к дашборду
        </Link>
      </div>
    );
  }

  // --- Вычисления для всех секций страницы ---
  const color = GOAL_COLORS[data.id] ?? 'brand';
  // Достигнутый уровень: последний порог <= current (даёт текущий бонус)
  const currentLevel = achievedThreshold(data.thresholds, data.current);
  // Ближайший недостиженный порог или null (все закрыты)
  const next = nextThreshold(data.thresholds, data.current);
  // Для бара целим следующий порог, а не финальный target — «до ближайшей награды»
  const remaining = next ? Math.max(0, next.value - data.current) : 0;
  // Ожидаемая выплата в ₽/год: достигнутый бонус × курс (округление до 0.1)
  const expectedRub = currentLevel
    ? Math.round(currentLevel.bonus * INDEX_TO_RUB * 10) / 10
    : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      {/* Хлебные крошки: landmark nav по стандарту доступности */}
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

      {/* Секция 1 «Ваш прогресс»: крупный bar до следующего порога + остаток/подсказка */}
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
          {/* Пока есть следующий порог — показываем остаток до разблокировки;
              иначе — общий hint цели ("Бонус активен!") */}
          {remaining > 0
            ? `Осталось: ${formatWithUnit(remaining, data.unit)} до разблокировки`
            : data.hint}
        </p>
      </section>

      {/* Секция 2 «Условия»: полный список порогов с отметками ✓ достигнуто / ожидается */}
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

      {/* Секция 3 «Ваш бонус»: dl-список «кто/что» — текущий бонус, выплата, прирост дальше */}
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
          {/* Если есть ещё недостиженные пороги — показываем будущий прирост в ₽ */}
          {next && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">После {formatWithUnit(next.value, data.unit)}:</dt>
              <dd className="font-bold tabular-nums text-ink">
                +{next.bonus} (+{formatRub(Math.round(next.bonus * INDEX_TO_RUB * 10) / 10)})
              </dd>
            </div>
          )}
        </dl>
        {/* «Математика выгоды»: сразу после годовой суммы — строка про капитализацию.
            Бонус не разовый: при реинвестировании следующий год считается от
            увеличенной базы (см. utils/compound.ts) */}
        <p className="mt-3 border-t border-gold/25 pt-3 text-sm leading-relaxed text-muted" role="note">
          📈 {COMPOUND_THOUGHTS.afterAnnual}
        </p>
      </section>

      {/* Секция 4 «Как достичь»: нумерованный список шагов из данных цели */}
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

      {/* Секция 5 «Следующий уровень»: рендерится только если остались пороги */}
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
          {/* Мысль для карточки уровней: каждый новый бонус — база следующей капитализации */}
          <p className="mt-2 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.levels}</p>

          {/* UX-фича «прогноз» на деталях цели: дата закрытия следующего порога
              при сохранении исторического темпа. forecastWeeks возвращает null,
              если темп неизвестен (ratePerWeek отсутствует) — блок скрывается. */}
          {(() => {
            const weeks = forecastWeeks(
              remainingToTarget({ current: data.current, target: next.value }),
              data.ratePerWeek ?? 0,
            );
            if (weeks === null) return null;
            const date = forecastDate(weeks);
            return (
              <p className="mt-2 text-sm font-medium text-brand tabular-nums" role="note">
                📈 При текущем темпе (~{formatWithUnit(data.ratePerWeek ?? 0, `${data.unit}/нед`)})
                порог будет закрыт через ~{weeks} {weeks === 1 ? 'неделю' : weeks < 5 ? 'недели' : 'недель'}
                {date ? `, ориентировочно ${date.toLocaleDateString('ru-RU')}` : ''}
              </p>
            );
          })()}
        </section>
      )}

      {/* FAQ про сложный процент: врезка с главной мыслью (тот же компонент,
          что на дашборде — переиспользование без дублирования текста) */}
      <CompoundInsight text={COMPOUND_THOUGHTS.faq20weeks} />

      {/* CTA-кнопка целевого действия (в демо — без обработчика: нет платёжного бэкенда) */}
      <button
        type="button"
        className="w-full rounded-xl bg-brand px-4 py-3 text-base font-bold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        Пополнить сейчас
      </button>
    </div>
  );
}
