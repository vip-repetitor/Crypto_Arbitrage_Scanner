import { describe, expect, it } from 'vitest';
import {
  achievedThreshold,
  goalPercent,
  indexLevel,
  nextThreshold,
  remainingToTarget,
  shouldPulse,
  sumGoalBonus,
} from '../utils/calculations';
import { formatRub, formatIndex, relativeDate } from '../utils/format';
import { mockGoals } from '../utils/mockData';
import type { Goal } from '../types';

describe('calculations', () => {
  it('goalPercent: 1500/2000 = 75%, перевыполнение ограничено 100', () => {
    expect(goalPercent({ current: 1500, target: 2000 })).toBe(75);
    expect(goalPercent({ current: 4, target: 3 })).toBe(100);
    expect(goalPercent({ current: 5, target: 0 })).toBe(0);
  });

  it('remainingToTarget не отрицателен', () => {
    expect(remainingToTarget({ current: 1500, target: 2000 })).toBe(500);
    expect(remainingToTarget({ current: 4, target: 3 })).toBe(0);
  });

  it('nextThreshold возвращает недостиженный порог', () => {
    expect(nextThreshold([{ value: 8, bonus: 0.3 }, { value: 20, bonus: 0.5 }], 12)).toEqual({
      value: 20,
      bonus: 0.5,
    });
    expect(nextThreshold([{ value: 8, bonus: 0.3 }], 10)).toBeNull();
  });

  it('achievedThreshold возвращает последний пройденный', () => {
    expect(achievedThreshold([{ value: 8, bonus: 0.3 }, { value: 20, bonus: 0.5 }], 12)?.bonus).toBe(0.3);
    expect(achievedThreshold([{ value: 8, bonus: 0.3 }], 5)).toBeNull();
  });

  it('sumGoalBonus по мок-данным = 0.5 (лояльность 0.3 + активность 0.2)', () => {
    expect(sumGoalBonus(mockGoals)).toBeCloseTo(0.5, 5);
  });

  it('indexLevel классифицирует индекс', () => {
    expect(indexLevel(0.2)).toBe('low');
    expect(indexLevel(0.6)).toBe('medium');
    expect(indexLevel(0.9)).toBe('high');
  });

  it('shouldPulse: цель в процессе и >80%', () => {
    const goal = (over: Partial<Goal>): Goal => ({
      id: 'x', title: '', icon: '', unit: '₽', bonus: '', hint: '',
      thresholds: [], description: '', steps: [],
      current: 1500, target: 2000, status: 'in_progress', ...over,
    });
    expect(shouldPulse(goal({ current: 1700 }))).toBe(true); // 85%
    expect(shouldPulse(goal({ current: 1500 }))).toBe(false); // 75%
    expect(shouldPulse(goal({ current: 1900, status: 'achieved' }))).toBe(false);
  });
});

describe('format', () => {
  it('formatRub с неразрывным пробелом и знаком', () => {
    expect(formatRub(1500)).toContain('1');
    expect(formatRub(-100)).toMatch(/−100\s?00?\s?₽|−100 ₽/);
  });

  it('formatIndex через запятую', () => {
    expect(formatIndex(0.6)).toBe('0,6');
  });

  it('relativeDate: вчера/сегодня относительно мока', () => {
    expect(relativeDate('2025-01-15 14:30')).toMatch(/^Сегодня/);
    expect(relativeDate('2025-01-14 09:00')).toMatch(/^Вчера/);
  });
});
