/**
 * leaderboard.test.ts — юнит-тесты математической модели лидерборда.
 * Проверяем детерминизм, корректность индексов по модели выплат и экономику доходности.
 */
import { describe, it, expect } from 'vitest';
import {
  generateLeaderboard,
  aggregateStats,
  BASE_YIELD_PCT,
} from '../utils/leaderboard';

describe('generateLeaderboard', () => {
  it('детерминирован: один seed даёт идентичную выборку', () => {
    const a = generateLeaderboard(20);
    const b = generateLeaderboard(20);
    expect(a).toEqual(b);
  });

  it('разные seed дают разные данные (PRNG работает)', () => {
    expect(generateLeaderboard(10, 1)).not.toEqual(generateLeaderboard(10, 2));
  });

  it('ранги уникальны и идут 1..N после сортировки по ₽/год', () => {
    const rows = generateLeaderboard(25);
    expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].yearlyRub).toBeGreaterThanOrEqual(rows[i].yearlyRub);
    }
  });

  it('индекс в допустимом диапазоне модели [0.1 .. 1.3] и кратен 0.1', () => {
    for (const r of generateLeaderboard(40)) {
      expect(r.index).toBeGreaterThanOrEqual(0.1);
      expect(r.index).toBeLessThanOrEqual(1.3);
      // все слагаемые модели (0.1/0.2/0.3/0.4/0.5) -> индекс кратно 0.1
      expect(Math.round(r.index * 10) % 1).toBe(0);
      expect(+((r.index * 10) % 1).toFixed(6)).toBe(0);
    }
  });

  it('доходность = 4% ОФЗ + премия за индекс; ₽/год = deposit × yield', () => {
    for (const r of generateLeaderboard(30)) {
      expect(r.yieldPct).toBeGreaterThan(BASE_YIELD_PCT);
      expect(r.yearlyRub).toBe(Math.round((r.deposit * r.yieldPct) / 100));
    }
  });

  it('строка «Вы» добавляется при передаче данных пользователя и имеет isMe', () => {
    const rows = generateLeaderboard(20, 20250115, 0.6, 1500);
    const me = rows.find((r) => r.isMe);
    expect(me).toBeDefined();
    expect(me?.index).toBe(0.6);
    // калибровка из ТЗ: индекс 0.6 → 4% + 6 шагов×0.45% = 6.7%
    expect(me?.yieldPct).toBeCloseTo(6.7, 1);
    expect(rows).toHaveLength(21);
  });

  it('goalsAchieved согласован с ненулевыми вкладами целей (0..3)', () => {
    for (const r of generateLeaderboard(40)) {
      expect(r.goalsAchieved).toBeGreaterThanOrEqual(0);
      expect(r.goalsAchieved).toBeLessThanOrEqual(3);
      // если индекс выше базового 0.1 — хотя бы одна цель достигнута
      if (r.index > 0.1) expect(r.goalsAchieved).toBeGreaterThan(0);
    }
  });
});

describe('aggregateStats', () => {
  it('на пустой выборке возвращает нули без NaN', () => {
    expect(aggregateStats([])).toEqual({
      users: 0, avgYieldPct: 0, totalYearlyRub: 0, topYieldPct: 0, avgIndex: 0,
    });
  });

  it('агрегаты совпадают с ручным пересчётом', () => {
    const rows = generateLeaderboard(15);
    const stats = aggregateStats(rows);
    expect(stats.users).toBe(15);
    expect(stats.topYieldPct).toBe(Math.max(...rows.map((r) => r.yieldPct)));
    expect(stats.totalYearlyRub).toBe(Math.round(rows.reduce((s, r) => s + r.yearlyRub, 0)));
    expect(stats.avgYieldPct).toBeCloseTo(
      rows.reduce((s, r) => s + r.yieldPct, 0) / 15, 1,
    );
  });
});
