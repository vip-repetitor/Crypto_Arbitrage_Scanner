/**
 * compound.ts — математика сложного процента для бонуса к индексу участия.
 *
 * Логика:
 *  - Бонус к индексу переводится в годовые рубли через INDEX_TO_RUB (1.0 индекса ≈ 750 ₽/год на 100 000 ₽ базы).
 *  - При реинвестировании доход каждого года прибавляется к базе, и следующий год считается
 *    уже от увеличенной суммы: base_{n+1} = base_n + income_n. Это классическая формула
 *    капитализации A = P * (1 + r)^t, но мы считаем её построчно, чтобы показать каждый год в UI.
 *  - Ставка r = bonusRubPerYear / principal (для 100 000 ₽ и бонуса +37.5 ₽ это 0.0375%).
 */
import { INDEX_TO_RUB } from '../types';

export interface CompoundYearRow {
  /** Номер года, начиная с 1 */
  year: number;
  /** База на начало года (сумма, на которую начисляется доход) */
  baseStart: number;
  /** Доход за этот год (₽) */
  income: number;
  /** Накопленный итог на конец года (база + доход) */
  totalEnd: number;
}

export interface CompoundProjection {
  rows: CompoundYearRow[];
  /** Суммарный доход за все годы при простом проценте (без реинвеста) */
  simpleTotal: number;
  /** Суммарный доход при реинвестировании */
  compoundTotal: number;
  /** Выгода капитализации: compoundTotal - simpleTotal */
  extra: number;
}

/** Годовой доход (₽) от бонуса к индексу: индекс × 750 ₽ за 1.0 на базу 100 000 ₽. */
export function annualBonusRub(index: number): number {
  return index * INDEX_TO_RUB;
}

/**
 * Построить помесячно-годовую траекторию капитализации.
 * @param principal начальная сумма (₽), по умолчанию демо-база 100 000 ₽
 * @param index текущий индекс участия (0..1.3)
 * @param years горизонт расчёта
 */
export function projectCompound(
  principal = 100_000,
  index = 0.6,
  years = 5,
): CompoundProjection {
  const rate = annualBonusRub(index) / principal; // доля ставки за год
  const rows: CompoundYearRow[] = [];
  let base = principal;
  let compoundTotal = 0;
  for (let y = 1; y <= years; y++) {
    const income = base * rate;
    compoundTotal += income;
    rows.push({ year: y, baseStart: base, income, totalEnd: base + income });
    base += income; // реинвестирование: доход остаётся в базе
  }
  const simpleTotal = principal * rate * years;
  return { rows, simpleTotal, compoundTotal, extra: compoundTotal - simpleTotal };
}
