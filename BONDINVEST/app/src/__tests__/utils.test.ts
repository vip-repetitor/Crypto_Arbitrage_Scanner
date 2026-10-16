/**
 * utils.test.ts — юнит-тесты чистой бизнес-логики (calculations + format).
 * Тестируем «независимо от реализации»: проверяем входы/выходы функций по ТЗ,
 * а не детали внутренних выражений. Границы (0%, 100%, деление на ноль,
 * отрицательные остатки) покрыты отдельно — именно там чаще всего баги.
 */
import { describe, expect, it } from 'vitest';
import {
  achievedThreshold,
  goalPercent,
  indexLevel,
  nextThreshold,
  remainingToTarget,
  shouldPulse,
  sumGoalBonus,
  isAlmostAchieved,
  forecastWeeks,
  forecastDate,
  rubPerIndexStep,
} from '../utils/calculations';
import { formatRub, formatIndex, relativeDate } from '../utils/format';
import { mockGoals } from '../utils/mockData';
import type { Goal } from '../types';

describe('calculations', () => {
  // Обычный случай + два краевых: перевыполнение (клампинг 100%) и target=0 (защита от NaN)
  it('goalPercent: 1500/2000 = 75%, перевыполнение ограничено 100', () => {
    expect(goalPercent({ current: 1500, target: 2000 })).toBe(75);
    expect(goalPercent({ current: 4, target: 3 })).toBe(100);
    expect(goalPercent({ current: 5, target: 0 })).toBe(0);
  });

  // Остаток не может быть отрицательным — иначе UI покажет «Осталось: -200₽»
  it('remainingToTarget не отрицателен', () => {
    expect(remainingToTarget({ current: 1500, target: 2000 })).toBe(500);
    expect(remainingToTarget({ current: 4, target: 3 })).toBe(0);
  });

  // Двухуровневая система порогов: при 12 из [8,20] следующий — 20; все пройдены — null
  it('nextThreshold возвращает недостиженный порог', () => {
    expect(nextThreshold([{ value: 8, bonus: 0.3 }, { value: 20, bonus: 0.5 }], 12)).toEqual({
      value: 20,
      bonus: 0.5,
    });
    expect(nextThreshold([{ value: 8, bonus: 0.3 }], 10)).toBeNull();
  });

  // Достигнутым считается порог, значение которого current >= value (строгое равенство включительно)
  it('achievedThreshold возвращает последний пройденный', () => {
    expect(achievedThreshold([{ value: 8, bonus: 0.3 }, { value: 20, bonus: 0.5 }], 12)?.bonus).toBe(0.3);
    expect(achievedThreshold([{ value: 8, bonus: 0.3 }], 5)).toBeNull();
  });

  // Интеграция логики с мок-данными: Лояльность 12≥8 (+0.3), Активность 4≥3 (+0.2), Объём 1500<2000 (0)
  it('sumGoalBonus по мок-данным = 0.5 (лояльность 0.3 + активность 0.2)', () => {
    expect(sumGoalBonus(mockGoals)).toBeCloseTo(0.5, 5);
  });

  // Границы категорий индекса по ТЗ: <0.3 low, 0.3–0.7 medium, >0.7 high
  it('indexLevel классифицирует индекс', () => {
    expect(indexLevel(0.2)).toBe('low');
    expect(indexLevel(0.6)).toBe('medium');
    expect(indexLevel(0.9)).toBe('high');
  });

  // Пульсация = in_progress И >80%; проверяем обе составляющие и границу 80% (не включает)
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
  // Русская локаль: неразрывные пробелы в разделителях тысяч; минус — типографский «−»
  it('formatRub с неразрывным пробелом и знаком', () => {
    expect(formatRub(1500)).toContain('1');
    expect(formatRub(-100)).toMatch(/−100\s?00?\s?₽|−100 ₽/);
  });

  // Decimal separator ru-RU — запятая (важно для tabular-nums цифр индекса)
  it('formatIndex через запятую', () => {
    expect(formatIndex(0.6)).toBe('0,6');
  });

  // Отсчёт ведётся от REFERENCE_TODAY мока (2025-01-15), а не от системных часов —
  // тест детерминирован при любом реальном времени запуска
  it('relativeDate: вчера/сегодня относительно мока', () => {
    expect(relativeDate('2025-01-15 14:30')).toMatch(/^Сегодня/);
    expect(relativeDate('2025-01-14 09:00')).toMatch(/^Вчера/);
  });
});

/**
 * UX-фичи (цикл «улучшения пользовательского опыта»): прогноз достижения,
 * «почти достигнута», перевод индекса в деньги. Тестируем чистые функции —
 * именно на них завязан рендеринг новых блоков UI.
 */
describe('UX: forecastWeeks / forecastDate', () => {
  it('округляет прогноз вверх: 500₽ при темпе 375₽/нед → 2 недели', () => {
    expect(forecastWeeks(500, 375)).toBe(2);
  });
  it('темпа нет (0) или цель уже закрыта (remaining<=0) → null, блок скрывается', () => {
    expect(forecastWeeks(500, 0)).toBeNull();
    expect(forecastWeeks(0, 375)).toBeNull();
    expect(forecastWeeks(-100, 375)).toBeNull();
  });
  it('forecastDate прибавляет N недель к заданной дате', () => {
    const from = new Date('2026-01-05T00:00:00');
    const d = forecastDate(2, from);
    expect(d).not.toBeNull();
    expect(d!.getTime() - from.getTime()).toBe(14 * 24 * 3600 * 1000);
  });
});

describe('UX: isAlmostAchieved (info-напоминание >=90%)', () => {
  const base: Goal = {
    id: 'volume', title: 'Объём', icon: '💰', current: 1850, target: 2000,
    unit: '₽', bonus: '+0.2', status: 'in_progress', hint: '', thresholds: [],
    description: '', steps: [],
  };
  it('92% in_progress → true', () => expect(isAlmostAchieved(base)).toBe(true));
  it('achieved с тем же прогрессом → false (уже разблокировано)', () =>
    expect(isAlmostAchieved({ ...base, status: 'achieved' })).toBe(false));
  it('85% → false (ещё рано напоминать)', () =>
    expect(isAlmostAchieved({ ...base, current: 1700 })).toBe(false));
});

describe('UX: rubPerIndexStep (цена шага индекса)', () => {
  it('+0.2 к индексу ≈ 15₽/год при курсе 75', () => {
    expect(rubPerIndexStep(0.2, 75)).toBe(15);
  });
  it('максимум 1.3 ≈ 97.5₽/год', () => {
    expect(rubPerIndexStep(1.3, 75)).toBe(97.5);
  });
});
