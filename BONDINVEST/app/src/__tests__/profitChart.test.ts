/**
 * profitChart.test.ts — юнит-тесты математики графика прибыли.
 * Проверяют инварианты финансовой модели: монотонность, паритет с annualBonusRub,
 * преимущество капитализации и корректность SVG-координат.
 */
import { describe, expect, it } from 'vitest';
import {
  buildProfitSeries,
  formatProfitTick,
  monthlyProfitPath,
  toPolyline,
} from '../utils/profitChart';
import { MAX_PARTICIPATION_INDEX } from '../types';
import { annualBonusRub } from '../utils/compound';

describe('monthlyProfitPath', () => {
  it('начинается с нуля и содержит месяц 0 + все месяцы горизонта', () => {
    const pts = monthlyProfitPath(0.6, 100_000, 1);
    expect(pts).toHaveLength(13); // 0..12
    expect(pts[0]).toEqual({ month: 0, value: 0 });
  });

  it('монотонно растёт (доход не убывает)', () => {
    const pts = monthlyProfitPath(0.8, 100_000, 3);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].value).toBeGreaterThan(pts[i - 1].value);
    }
  });

  it('годовой доход без реинвеста ≈ annualBonusRub (помесячная разбивка)', () => {
    const simple = monthlyProfitPath(0.6, 100_000, 1, false);
    expect(simple[12].value).toBeCloseTo(annualBonusRub(0.6), 0);
  });

  it('с реинвестом доход за год строго больше простого (эффект капитализации)', () => {
    const compound = monthlyProfitPath(0.6, 100_000, 1, true);
    const simple = monthlyProfitPath(0.6, 100_000, 1, false);
    expect(compound[12].value).toBeGreaterThan(simple[12].value);
  });

  it('нулевой индекс даёт нулевую прибыль', () => {
    const pts = monthlyProfitPath(0, 100_000, 5);
    expect(pts.every((p) => p.value === 0)).toBe(true);
  });
});

describe('buildProfitSeries', () => {
  it('возвращает 3 серии: текущая, без реинвеста, максимум', () => {
    const s = buildProfitSeries(0.6, 100_000, 3);
    expect(s).toHaveLength(3);
    expect(s[2].label).toContain(String(MAX_PARTICIPATION_INDEX));
  });

  it('максимальная серия всегда выше текущей при индексе < 1.3', () => {
    const s = buildProfitSeries(0.6, 100_000, 5);
    const last = (arr: typeof s[number]['points']) => arr[arr.length - 1].value;
    expect(last(s[2].points)).toBeGreaterThan(last(s[0].points));
  });

  it('при индексе = максимум текущая и максимальная серии совпадают', () => {
    const s = buildProfitSeries(MAX_PARTICIPATION_INDEX, 100_000, 1);
    const last = (i: number) => s[i].points.at(-1)!.value;
    expect(last(0)).toBeCloseTo(last(2), 6);
  });
});

describe('toPolyline / formatProfitTick', () => {
  it('полилин содержит по паре координат на каждую точку', () => {
    const pts = monthlyProfitPath(0.6, 100_000, 1);
    const line = toPolyline(pts, 560, 220, 100);
    expect(line.split(' ')).toHaveLength(pts.length);
    expect(line.startsWith('6.0,')).toBe(true); // старт у левого поля
  });

  it('форматирует ₽ компактно: тыс/млн', () => {
    expect(formatProfitTick(950)).toBe('950 ₽');
    expect(formatProfitTick(12_500)).toBe('13 тыс ₽');
    expect(formatProfitTick(1_250_000)).toBe('1.3 млн ₽');
  });
});
