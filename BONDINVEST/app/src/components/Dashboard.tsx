import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, ProgressBarColor } from '../types';
import { INDEX_TO_RUB } from '../types';
import { useDashboard } from '../hooks/useGoals';
import { indexLevel, nextThreshold } from '../utils/calculations';
import { formatIndex, formatRub } from '../utils/format';
import { useCountUp } from '../hooks/useAnimations';
import { GoalCard } from './GoalCard';
import { ProgressBar } from './ProgressBar';
import { TransactionRow } from './TransactionRow';
import { AchievementToast, type AchievementInfo } from './AchievementToast';

const GOAL_COLORS: Record<string, ProgressBarColor> = {
  loyalty: 'gold',
  volume: 'success',
  activity: 'brand',
};

/** IndexScore — карточка общего индекса участия */
function IndexScoreCard({
  index,
  maxIndex,
  expectedBonusRub,
}: {
  index: number;
  maxIndex: number;
  expectedBonusRub: number;
}) {
  const animated = useCountUp(index, 800);
  const level = indexLevel(index);
  const levelLabel =
    level === 'high' ? 'Высокий уровень участия' : level === 'medium' ? 'Средний уровень участия' : 'Начальный уровень участия';

  return (
    <section
      aria-label="Общий индекс участия"
      className="rounded-2xl border border-line bg-white p-6 shadow-card"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted tabular-nums">
            🎯 Ваш индекс участия · {levelLabel}
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-ink">
            {formatIndex(animated)}
            <span className="text-2xl text-muted"> / {formatIndex(maxIndex)}</span>
          </p>
        </div>
        <p className="text-right text-sm text-muted">
          Ожидаемый бонус:
          <br />
          <span className="text-lg font-bold tabular-nums text-gold">
            ~{formatRub(expectedBonusRub)}/год
          </span>
        </p>
      </div>
      <div className="mt-4">
        <ProgressBar
          current={index}
          target={maxIndex}
          color="brand"
          size="lg"
          ariaLabel="Общий индекс участия"
        />
      </div>
    </section>
  );
}

/** Dashboard — главный экран: индекс, цели, ожидаемый бонус, последние транзакции */
export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();
  const [achievement, setAchievement] = useState<AchievementInfo | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <p className="text-base text-muted">Загрузка данных…</p>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-danger">Не удалось загрузить данные. Повторите позже.</p>;
  }

  const achievedCount = data.goals.filter((g) => g.status === 'achieved').length;

  const openGoal = (goal: Goal) => {
    // Демонстрация AchievementToast: показываем при входе в уже разблокированную цель
    if (goal.status === 'achieved') {
      const nxt = nextThreshold(goal.thresholds, goal.current);
      setAchievement({
        goal,
        bonusRub: Math.round(parseFloat(goal.bonus.replace('+', '')) * INDEX_TO_RUB * 10) / 10,
        nextLevelText: nxt
          ? `Следующая цель: ${nxt.value} ${goal.unit} для бонуса +${nxt.bonus} к индексу`
          : null,
      });
    }
    navigate(`/goal/${goal.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Привет, {data.userName}! 👋</h1>
      </header>

      <IndexScoreCard
        index={data.totalIndex}
        maxIndex={data.maxIndex}
        expectedBonusRub={data.expectedBonusRub}
      />

      <section aria-label="Ваши цели">
        <h2 className="mb-3 text-xl font-semibold text-ink">
          Ваши цели{' '}
          <span className="text-sm font-normal text-muted">
            ({achievedCount} из {data.goals.length} разблокировано)
          </span>
        </h2>
        <div className="grid gap-4">
          {data.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              title={goal.title}
              icon={goal.icon}
              progress={{ current: goal.current, target: goal.target, unit: goal.unit }}
              bonus={goal.bonus}
              status={goal.status}
              hint={goal.hint}
              color={GOAL_COLORS[goal.id] ?? 'brand'}
              onClick={() => openGoal(goal)}
            />
          ))}
        </div>
      </section>

      <section aria-label="Последние транзакции" className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Последние транзакции</h2>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Смотреть все
          </button>
        </div>
        <ul>
          {data.transactions.slice(0, 5).map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </ul>
      </section>

      <AchievementToast achievement={achievement} onDismiss={() => setAchievement(null)} />
    </div>
  );
}
