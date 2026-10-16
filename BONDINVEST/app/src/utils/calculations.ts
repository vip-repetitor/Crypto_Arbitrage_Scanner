import type { Goal, Threshold } from '../types';

/** Процент выполнения цели (0..100), current может превышать target */
export function goalPercent(goal: Pick<Goal, 'current' | 'target'>): number {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.round((goal.current / goal.target) * 100));
}

/** Осталось до целевого значения (не меньше 0) */
export function remainingToTarget(goal: Pick<Goal, 'current' | 'target'>): number {
  return Math.max(0, goal.target - goal.current);
}

/** Найденный следующий (недостиженный) порог */
export function nextThreshold(thresholds: Threshold[], current: number): Threshold | null {
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  return sorted.find((t) => current < t.value) ?? null;
}

/** Последний достигнутый порог (или null) */
export function achievedThreshold(thresholds: Threshold[], current: number): Threshold | null {
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  const passed = sorted.filter((t) => current >= t.value);
  return passed.length ? passed[passed.length - 1] : null;
}

/** Суммарный вклад всех целей в индекс участия */
export function sumGoalBonus(goals: Goal[]): number {
  return goals.reduce((acc, g) => {
    const achieved = achievedThreshold(g.thresholds, g.current);
    return acc + (achieved?.bonus ?? 0);
  }, 0);
}

/** Конвертация индекса в ожидаемый годовой бонус в рублях */
export function indexToRub(index: number, rate: number): number {
  return Math.round(index * rate * 10) / 10;
}

/** Категория общего индекса для IndexScore */
export function indexLevel(index: number): 'low' | 'medium' | 'high' {
  if (index < 0.3) return 'low';
  if (index <= 0.7) return 'medium';
  return 'high';
}

/** Пульсация нужна, если цель в процессе и прогресс > 80% */
export function shouldPulse(goal: Goal): boolean {
  return goal.status === 'in_progress' && goalPercent(goal) > 80;
}
