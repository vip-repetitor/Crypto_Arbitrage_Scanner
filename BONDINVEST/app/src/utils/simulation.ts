/**
 * simulation.ts — «виртуальный пользователь» для тестового фронтенда.
 *
 * Логика: модуль генерирует случайную последовательность действий (пополнения,
 * удержание недель, вывод средств) и на их основе пересчитывает состояние
 * мокового «бэкенда»: цели, транзакции, общий индекс. Никакого реального API
 * нет — вся имитация живёт на клиенте, данные хранятся в замыкании (state),
 * а подписчики получают новый снимок через callback.
 *
 * Как это попадает на фронт:
 * - useSimulation делает setQueryData(...) в кэш React Query под теми же
 *   ключами, что читают страницы (['goals'], ['dashboard'], ['transactions']),
 *   поэтому Dashboard/GoalDetails мгновенно перерисовываются с новыми данными;
 * - при переходе порога цели вызывается onThresholdReached → AchievementToast
 *   с конфетти (тот же компонент, что в основном приложении).
 */
import type { DashboardData, Goal, Transaction } from '../types';
import { INDEX_TO_RUB, MAX_PARTICIPATION_INDEX } from '../types';
import { achievedThreshold, nextThreshold, sumGoalBonus } from './calculations';

/** Действие, которое «совершил» виртуальный пользователь за один шаг симуляции. */
export interface SimAction {
  /** deposit — пополнение (цель «Объём» + «Активность»), hold — удержание (неделя «Лояльности»), withdraw — вывод */
  kind: 'deposit' | 'hold' | 'withdraw';
  /** Сумма для deposit/withdraw (₽); для hold — количество добавленных недель */
  amount: number;
}

/** Полный снимок состояния мока после применения действия. */
export interface SimSnapshot {
  goals: Goal[];
  transactions: Transaction[];
  totalIndex: number;
  expectedBonusRub: number;
}

/** Колбэк уведомления UI о достижении нового порога (запуск тоста с конфетти). */
export type ThresholdListener = (goal: Goal, thresholdValue: number) => void;

/** Границы случайных сумм пополнения (₽) — подобраны так, чтобы порог 2000₽ достигался за несколько шагов. */
const DEPOSIT_RANGE: [number, number] = [100, 900];
/** Диапазон сумм вывода (₽): меньше, чем депозиты, чтобы баланс рос. */
const WITHDRAW_RANGE: [number, number] = [50, 300];
/** Вероятности выбора действия: чаще пополняем и удерживаем, редко выводим. */
const ACTION_WEIGHTS: Array<[SimAction['kind'], number]> = [
  ['deposit', 0.45],
  ['hold', 0.35],
  ['withdraw', 0.2],
];

let seq = 0; // счётчик для уникальных id транзакций симуляции

/** Равномерное целое случайное число в диапазоне [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Выбор действия по весам (рулетка):ACTION_WEIGHTS нормируется автоматически через накопление. */
function randomActionKind(): SimAction['kind'] {
  const roll = Math.random();
  let acc = 0;
  for (const [kind, weight] of ACTION_WEIGHTS) {
    acc += weight;
    if (roll <= acc) return kind;
  }
  return 'deposit'; // страховка от ошибок округления весов
}

/** Текущее время в формате мока "YYYY-MM-DD HH:mm" — даты новых транзакций. */
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Фабрика симуляции. Инкапсулирует mutable-состояние внутри замыкания,
 * наружу отдаёт только чистые методы (getSnapshot / applyRandomAction / subscribe).
 * Стартовое состояние копируется из переданного снапшота (обычно mockDashboard),
 * чтобы демо начиналось с данных из ТЗ (индекс 0.6, 12 недель, 1500₽, 4 пополнения).
 */
export function createSimulation(initial: DashboardData) {
  // Глубокая копия стартовых целей/транзакций: симуляция не должна мутировать исходный мок.
  let goals: Goal[] = initial.goals.map((g) => ({ ...g, thresholds: g.thresholds.map((t) => ({ ...t })) }));
  let transactions: Transaction[] = [...initial.transactions];
  let listeners: ThresholdListener[] = [];

  /**
   * Пересчёт производных величин по текущим целям.
   * Логика: суммируем бонусы всех достигнутых порогов (sumGoalBonus), ограничиваем
   * сверху теоретическим максимумом индекса, переводим в ₽ через INDEX_TO_RUB.
   */
  function derive(totalCurrentIndex?: number): SimSnapshot {
    const totalIndex = Math.min(MAX_PARTICIPATION_INDEX, totalCurrentIndex ?? sumGoalBonus(goals));
    return {
      goals,
      transactions,
      totalIndex: Number(totalIndex.toFixed(2)),
      expectedBonusRub: Number((totalIndex * INDEX_TO_RUB).toFixed(1)),
    };
  }

  /**
   * Применяет одно действие пользователя и возвращает новый снимок.
   * Пошаговая логика:
   * 1. Находим целевую цель по id (map по GOAL_IDS — фиксированный порядок);
   * 2. Обновляем current (лояльность +1 неделя, объём +сумма, активность +1);
   * 3. Пересчитываем статус/подсказку по порогам (thresholds);
   * 4. Если current пересёк ранее недостигнутый порог — уведомляем подписчиков (конфетти);
   * 5. Добавляем транзакцию в начало списка ( newest first ).
   */
  function applyAction(action: SimAction): SimSnapshot {
    let crossedGoal: Goal | null = null;
    let crossedValue = 0;

    goals = goals.map((g) => {
      let next = g;
      switch (action.kind) {
        case 'hold':
          if (g.id !== 'loyalty') return g;
          next = { ...g, current: g.current + action.amount };
          break;
        case 'deposit':
          if (g.id === 'volume') next = { ...g, current: g.current + action.amount };
          else if (g.id === 'activity') next = { ...g, current: g.current + 1 };
          break;
        case 'withdraw':
          // Вывод не двигает цели вперёд, но фиксируется в истории;
          // объём считаем по среднему депозиту, поэтому на него вывод не влияет.
          return g;
      }
      // --- пересчёт статуса/бонуса/подсказки через чистые функции из calculations.ts ---
      const top = achievedThreshold(next.thresholds, next.current); // последний достигнутый порог
      const status: Goal['status'] = top ? 'achieved' : next.current > 0 ? 'in_progress' : 'empty';
      const remainingFirst = Math.max(0, next.thresholds[0].value - next.current);
      const upcoming = nextThreshold(next.thresholds, next.current); // ближайший недостигнутый
      const hint = top
        ? upcoming
          ? `До следующего уровня: ${upcoming.value - next.current} ${next.unit}`
          : 'Бонус активен!'
        : `Осталось: ${remainingFirst} ${next.unit} до разблокировки`;
      next = { ...next, status, hint, bonus: top ? `+${top.bonus.toFixed(1)}` : g.bonus };
      // --- детект пересечения порога (только вверх, без повторных срабатываний) ---
      const wasAchieved = !!achievedThreshold(g.thresholds, g.current);
      if (!wasAchieved && top) {
        crossedGoal = next;
        crossedValue = top.value;
      }
      return next;
    });

    // Транзакция: сумма со знаком (+ пополнение, − вывод); для hold денег нет — пишем «удержание».
    const tx: Transaction = {
      id: `sim-${Date.now()}-${seq++}`,
      type: action.kind === 'withdraw' ? 'withdraw' : action.kind === 'hold' ? 'bonus' : 'deposit',
      amount: action.kind === 'withdraw' ? -action.amount : action.kind === 'hold' ? 0 : action.amount,
      date: nowStamp(),
      label:
        action.kind === 'hold'
          ? `Удержание ${action.amount} нед.`
          : action.kind === 'withdraw'
            ? 'Вывод на карту'
            : 'Пополнение счёта',
    };
    transactions = [tx, ...transactions].slice(0, 20); // держим историю компактной

    if (crossedGoal) listeners.forEach((fn) => fn(crossedGoal as Goal, crossedValue));
    return derive();
  }

  /** Генерирует одно случайное действие и применяет его (главный метод для «рандомного пользователя»). */
  function applyRandomAction(): SimSnapshot {
    const kind = randomActionKind();
    const amount =
      kind === 'deposit' ? randInt(...DEPOSIT_RANGE) : kind === 'withdraw' ? randInt(...WITHDRAW_RANGE) : 1; // hold = +1 неделя
    return applyAction({ kind, amount });
  }

  /** Подписка на события достижения порогов; возвращает функцию отписки. */
  function subscribe(fn: ThresholdListener): () => void {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }

  return {
    getSnapshot: () => derive(),
    applyRandomAction,
    subscribe,
  };
}

export type Simulation = ReturnType<typeof createSimulation>;
