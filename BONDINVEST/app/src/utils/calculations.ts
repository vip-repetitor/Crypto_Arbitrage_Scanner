/**
 * calculations.ts — чистые (pure) функции бизнес-логики.
 * Здесь нет React-кода и побочных эффектов: всё легко покрыть юнит-тестами
 * (см. src/__tests__/utils.test.ts). Компоненты только вызывают эти функции,
 * сама логика расчётов сосредоточена в одном месте.
 */
import type { Goal, Threshold } from '../types';

/**
 * Процент выполнения цели (0..100).
 * current может превышать target (напр. 4 пополнения при цели 3) —
 * значение ограничивается сверху 100%, чтобы прогресс-бар не «вылезал» за трек.
 * Защита от деления на ноль: target <= 0 → 0%.
 */
export function goalPercent(goal: Pick<Goal, 'current' | 'target'>): number {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.round((goal.current / goal.target) * 100));
}

/** Сколько осталось до целевого значения; никогда не возвращает отрицательное число. */
export function remainingToTarget(goal: Pick<Goal, 'current' | 'target'>): number {
  return Math.max(0, goal.target - goal.current);
}

/**
 * Следующий (ближайший недостиженный) порог цели или null, если все пороги закрыты.
 * Пороги сортируются по возрастанию, чтобы вызывающий код мог передать массив в любом порядке.
 * Используется в GoalDetails («Следующий уровень») и в AchievementToast («Следующая цель: …»).
 */
export function nextThreshold(thresholds: Threshold[], current: number): Threshold | null {
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  return sorted.find((t) => current < t.value) ?? null;
}

/**
 * Последний достигнутый порог (самый высокий из тех, что <= current) или null.
 * Даёт актуальный размер бонуса: если пользователь перескочил несколько ступеней,
 * учитывается максимальная достигнутая, а не первая.
 */
export function achievedThreshold(thresholds: Threshold[], current: number): Threshold | null {
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  const passed = sorted.filter((t) => current >= t.value);
  return passed.length ? passed[passed.length - 1] : null;
}

/**
 * Суммарный вклад всех целей в общий индекс участия:
 * для каждой цели берётся её последний достигнутый порог и складываются бонусы.
 * Это серверная формула индекса, воспроизведённая на клиенте для мока и тестов.
 */
export function sumGoalBonus(goals: Goal[]): number {
  return goals.reduce((acc, g) => {
    const achieved = achievedThreshold(g.thresholds, g.current);
    return acc + (achieved?.bonus ?? 0);
  }, 0);
}

/**
 * Конвертация индекса в ожидаемый годовой бонус в рублях (index × rate).
 * Округление до 0.1 ₽: умножаем на 10, округляем, делим на 10 —
 * чтобы показать «~45₽/год» без длинных дробей.
 */
export function indexToRub(index: number, rate: number): number {
  return Math.round(index * rate * 10) / 10;
}

/**
 * Категория индекса для компонент IndexScore по ТЗ:
 * low (<0.3), medium (0.3–0.7), high (>0.7). Влияет на подпись уровня.
 */
export function indexLevel(index: number): 'low' | 'medium' | 'high' {
  if (index < 0.3) return 'low';
  if (index <= 0.7) return 'medium';
  return 'high';
}

/**
 * Признак пульсации карточки цели: мягкое свечение включается,
 * только если цель «в процессе» И прогресс уже > 80% —
 * мотивация «дожать» почти достигнутый порог (по ТЗ).
 */
export function shouldPulse(goal: Goal): boolean {
  return goal.status === 'in_progress' && goalPercent(goal) > 80;
}
