/**
 * Dashboard.tsx — главный экран приложения (роут /).
 * Композует четыре блока макета ТЗ:
 *   1) IndexScoreCard — карточка общего индекса участия (0.0–1.3);
 *   2) список GoalCard — три цели;
 *   3) секция последних транзакций (до 5 шт.);
 *   4) AchievementToast — оверлей достижений поверх экрана.
 *
 * Поток данных: useDashboard() (React Query) → состояние data/isLoading/error.
 * Пока запрос в полёте — показываем блок role="status" (aria-live polite),
 * чтобы скринридер озвучил загрузку и её окончание. Ошибка — текстовое сообщение.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, ProgressBarColor } from '../types';
import { INDEX_TO_RUB } from '../types';
import { useDashboard } from '../hooks/useGoals';
import { useSimulation } from '../hooks/useSimulation';
import { indexLevel, nextThreshold, isAlmostAchieved } from '../utils/calculations';
import { formatIndex, formatRub } from '../utils/format';
import { useCountUp } from '../hooks/useAnimations';
import { GoalCard } from './GoalCard';
import { ProgressBar } from './ProgressBar';
import { TransactionRow } from './TransactionRow';
import { AchievementToast, type AchievementInfo } from './AchievementToast';
import { SimulationPanel } from './SimulationPanel';
// Контентные врезки про сложный процент (см. CompoundInterest.tsx)
import { CompoundInsight, CompoundCalculator, FaqCompound } from './CompoundInterest';

/** Закреплённый цвет прогресс-бара за каждой целью (согласно макету). */
const GOAL_COLORS: Record<string, ProgressBarColor> = {
  loyalty: 'gold',
  volume: 'success',
  activity: 'brand',
};

/** IndexScore — карточка общего индекса пользователя (состояния low/medium/high по ТЗ). */
function IndexScoreCard({
  index,
  maxIndex,
  expectedBonusRub,
}: {
  index: number;
  maxIndex: number;
  expectedBonusRub: number;
}) {
  // Число «набегает» от 0 до значения за 800ms (микроанимация из ТЗ «число баланса»)
  const animated = useCountUp(index, 800);
  const level = indexLevel(index);
  const levelLabel =
    level === 'high' ? 'Высокий уровень участия' : level === 'medium' ? 'Средний уровень участия' : 'Начальный уровень участия';

  /**
   * UX-фича «перевод индекса в деньги»: один шаг индекса (+0.1) ≈ N ₽/год.
   * Показываем это как пояснение под крупной цифрой — абстрактный индекс
   * становится понятной мотивацией («+0.2 к индексу ≈ +15₽/год»).
   */
  const rubPerTenth = Math.round(INDEX_TO_RUB * 0.1 * 10) / 10;

  return (
    <section
      aria-label="Общий индекс участия"
      className="relative overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-premium sm:p-8"
    >
      {/* Декоративное золотое свечение в углу hero-плитки (чистая эстетика, AT скрыто) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl"
      />
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium tabular-nums text-slate-300">
            🎯 Ваш индекс участия · {levelLabel}
          </p>
          {/* Крупная цифра 40px/700 tabular-nums: анимированное значение + максимум.
              Приём казино/банков: главная метрика — самый крупный элемент экрана */}
          <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
            {formatIndex(animated)}
            <span className="text-2xl font-semibold text-slate-300"> / {formatIndex(maxIndex)}</span>
          </p>
          {/* Расшифровка цены индекса для пользователя */}
          <p className="mt-2 text-xs tabular-nums text-slate-300">
            0.1 индекса ≈ +{formatRub(rubPerTenth)}/год · максимум ≈ +{formatRub(
            Math.round(INDEX_TO_RUB * maxIndex * 10) / 10,
          )}/год
          </p>
        </div>
        {/* Ожидаемый бонус — «джекпот-якорь»: сумма в золотом бейдже справа */}
        <div className="shrink-0 rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm ring-1 ring-white/15">
          <p className="text-xs text-slate-300">Ожидаемый бонус</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-gold-bright">
            ~{formatRub(expectedBonusRub)}/год
          </p>
        </div>
      </div>
      {/* Тот же ProgressBar, но крупный (size lg): шкала индекса 0 → maxIndex */}
      <div className="mt-5">
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
  // Тест-симулятор: состояние достижений, пришедших от «рандомного пользователя»
  const sim = useSimulation();
  // Локальное состояние тоста: null — скрыт; объект — показываем AchievementToast
  const [achievement, setAchievement] = useState<AchievementInfo | null>(null);

  /**
   * UX-фича «почти достигнута»: мягкое info-напоминание, когда цель в процессе
   * и прогресс >= 90%. Ref-множество notifiedGoals помнит, о каких целях мы уже
   * предупреждали, — напоминание показывается ОДИН раз на цель за сессию,
   * чтобы не спамить при каждой ревалидации React Query.
   */
  const notifiedGoals = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const almost = data.goals.find((g) => isAlmostAchieved(g) && !notifiedGoals.current.has(g.id));
    if (almost) {
      notifiedGoals.current.add(almost.id);
      // Не перекрываем активный праздничный тост — info показываем только в паузе
      setAchievement((prev) =>
        prev
          ? prev
          : {
              goal: almost,
              bonusRub: 0,
              nextLevelText: almost.hint,
              variant: 'info',
            },
      );
    }
  }, [data]);

  if (isLoading) {
    // UX-фича «скелетоны»: вместо пустого экрана — заглушки по реальной сетке
    // дашборда (карточка индекса + 3 цели + транзакции). role=status +
    // aria-live: AT озвучит начало и конец загрузки. shimmer-анимация в CSS,
    // отключается при prefers-reduced-motion.
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6" role="status" aria-live="polite">
        <p className="sr-only">Загрузка данных…</p>
        {/* Скелет карточки индекса */}
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <div className="skeleton h-4 w-56 rounded" />
          <div className="skeleton mt-3 h-10 w-40 rounded" />
          <div className="skeleton mt-5 h-3 w-full rounded-full" />
        </div>
        {/* Скелеты трёх целей */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="skeleton h-5 w-40 rounded" />
              <div className="skeleton h-5 w-28 rounded-full" />
            </div>
            <div className="skeleton mt-4 h-3 w-full rounded-full" />
            <div className="skeleton mt-3 h-4 w-48 rounded" />
          </div>
        ))}
        {/* Скелет списка транзакций */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton my-2 h-8 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-danger">Не удалось загрузить данные. Повторите позже.</p>;
  }

  // Счётчик «N из 3 разблокировано» в подзаголовке целей
  const achievedCount = data.goals.filter((g) => g.status === 'achieved').length;

  /**
   * Обработка клика по карточке цели:
   * - если цель уже achieved — в демо это трактуем как «порог только что достигнут»:
   *   собираем AchievementInfo (бонус в ₽ = число из "+0.3" × курс INDEX_TO_RUB,
   *   текст следующего уровня — из nextThreshold) и поднимаем тост;
   * - затем всегда навигация на страницу деталей /goal/:id.
   */
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      {/* Шапка с «успокаивающим» сабхедлайном — приём банков: сразу снимаем
          главный вопрос клиента («что мне за это будет») прямо в заголовке */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Привет, {data.userName}! 👋</h1>
        <p className="mt-1 text-sm text-muted">
          Ваши ОФЗ работают на вас: гарантированные 4% + бонусы за цели — до 10% годовых.
        </p>
      </header>

      {/* БЫСТРЫЕ МЕТРИКИ (казино/банковский лайфхак): полоса KPI под hero —
          пользователь за секунду считывает суть продукта не прокручивая экран */}
      <section aria-label="Ключевые показатели" className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Гарантия', value: '4%', sub: 'годовых, купон ОФЗ' },
          { label: 'Разблокировано', value: `${achievedCount}/${data.goals.length}`, sub: 'цели выполнено' },
          { label: 'Максимум', value: '10%', sub: 'при всех бонусах' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-line/70 bg-white p-3 text-center shadow-card sm:p-4"
          >
            <p className="text-lg font-bold tabular-nums text-ink sm:text-2xl">{kpi.value}</p>
            <p className="text-xs font-semibold text-brand">{kpi.label}</p>
            <p className="hidden text-xs text-muted sm:block">{kpi.sub}</p>
          </div>
        ))}
      </section>

      <IndexScoreCard
        index={data.totalIndex}
        maxIndex={data.maxIndex}
        expectedBonusRub={data.expectedBonusRub}
      />

      {/* Контентная врезка про сложный процент — главная мысль рядом с прогрессом:
          бонус не разовый, а «топливо» капитализации при реинвестировании */}
      <div className="mt-4">
        <CompoundInsight />
      </div>

      <section aria-label="Ваши цели" className="mt-6">
        <h2 className="mb-3 text-xl font-semibold text-ink">
          Три цели — три бонуса{' '}
          <span className="text-sm font-normal text-muted">
            ({achievedCount} из {data.goals.length} разблокировано)
          </span>
        </h2>
        {/* ПЛИТОЧНАЯ СЕТКА: 1 колонка на мобильном, 3 плитки в ряд на десктопе.
            goalPercent/высота карточек выровнены — ряд читается как витрина банка */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              ratePerWeek={goal.ratePerWeek}
              onClick={() => openGoal(goal)}
            />
          ))}
        </div>
      </section>

      {/* Двухколоночная сетка нижнего яруса (desktop): транзакции + навигация.
          На мобильном складывается в одну колонку — mobile-first приоритет */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Блок «Последние транзакции»: срезаем список до 5 (ТЗ) + переход на полную историю */}
        <section aria-label="Последние транзакции" className="rounded-3xl border border-line/70 bg-white p-5 shadow-premium">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Последние операции</h2>
            <div className="flex items-center gap-2">
              {/* UX: быстрый переход к лидерборду — социальное сравнение доходностей */}
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                📊 Лидерборд
              </button>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Смотреть все
              </button>
            </div>
          </div>
          <ul>
            {data.transactions.slice(0, 5).map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </ul>
        </section>

        {/* Тестовая панель: имитирует случайные действия пользователя и подгружает
            обновлённые данные прямо в кэш React Query (без перезагрузки страницы).
            В сетке занимает правую колонку (на мобильном — под транзакциями) */}
        <SimulationPanel />
      </div>

      {/* «Математика выгоды»: интерактивный калькулятор сложного процента + FAQ.
          Считает по живому totalIndex из React Query — после действий симулятора
          траектория дохода пересчитывается автоматически */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CompoundCalculator index={data.totalIndex} />
        <FaqCompound />
      </div>

      {/* Оверлей достижений: видимость управляется состоянием achievement.
          Достижение из тест-симулятора (sim.achievement) приоритетнее локального —
          так конфетти срабатывает именно на «живом» пересечении порога. */}
      <AchievementToast
        achievement={sim.achievement ?? achievement}
        onDismiss={() => {
          sim.dismissAchievement();
          setAchievement(null);
        }}
      />
    </div>
  );
}
