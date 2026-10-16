/**
 * compound.test.ts — юнит-тесты математики сложного процента (utils/compound.ts).
 * Проверяем три вещи: корректность ставки из индекса, построчную капитализацию
 * (каждый год считается от увеличенной базы) и то, что сложный процент всегда
 * не хуже простого (extra >= 0), растёт с горизонтом и совпадает с эталоном ТЗ
 * (37.5 → 37.51 → 37.52 ₽ для 100 000 ₽ и индекса 0.5 на бонусной части).
 */
import { describe, expect, it } from 'vitest';
import { annualBonusRub, projectCompound } from '../utils/compound';

describe('annualBonusRub', () => {
  it('переводит индекс в годовые рубли по курсу 75 ₽ за 0.1', () => {
    expect(annualBonusRub(0.6)).toBeCloseTo(45, 10); // 0.6 * 75
    expect(annualBonusRub(0.5)).toBeCloseTo(37.5, 10); // пример из контент-плана
    expect(annualBonusRub(0)).toBe(0);
  });
});

describe('projectCompound', () => {
  const p = projectCompound(100_000, 0.5, 3); // ставка 0.0375% как в примерах ТЗ

  it('год 1 даёт ровно 37.5 ₽, база следующего года увеличивается на доход', () => {
    expect(p.rows[0].income).toBeCloseTo(37.5, 10);
    expect(p.rows[1].baseStart).toBeCloseTo(100_037.5, 6);
    expect(p.rows[1].income).toBeCloseTo(37.514, 3); // ~37.51 ₽
    expect(p.rows[2].baseStart).toBeGreaterThan(p.rows[1].baseStart);
    expect(p.rows[2].income).toBeGreaterThan(p.rows[1].income); // ~37.52 ₽
  });

  it('сложный процент не хуже простого, выгода растёт с горизонтом', () => {
    expect(p.extra).toBeGreaterThanOrEqual(0);
    expect(p.compoundTotal).toBeGreaterThan(p.simpleTotal - 1e-9);
    const p10 = projectCompound(100_000, 0.5, 10);
    expect(p10.extra).toBeGreaterThan(p.extra); // длинный горизонт → больший эффект
  });

  it('нулевой индекс даёт нулевой доход без NaN', () => {
    const zero = projectCompound(100_000, 0, 5);
    expect(zero.compoundTotal).toBe(0);
    expect(zero.extra).toBe(0);
    expect(zero.rows.every((r) => r.income === 0)).toBe(true);
  });
});
