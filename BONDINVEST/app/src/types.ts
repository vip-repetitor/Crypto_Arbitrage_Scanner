export type GoalStatus = 'empty' | 'in_progress' | 'achieved' | 'locked';

export type ProgressBarColor = 'brand' | 'success' | 'gold';

export interface Threshold {
  /** Пороговое значение (в единицах цели) */
  value: number;
  /** Бонус к индексу при достижении порога */
  bonus: number;
}

export interface Goal {
  id: string;
  title: string;
  icon: string;
  current: number;
  target: number;
  unit: string;
  /** Подпись бонуса, напр. "+0.3" */
  bonus: string;
  status: GoalStatus;
  hint: string;
  /** Все пороги цели (для деталей и "следующего уровня") */
  thresholds: Threshold[];
  /** Описание условия */
  description: string;
  /** Пошаговая инструкция "Как достичь" */
  steps: string[];
}

export type TransactionType = 'deposit' | 'withdraw' | 'bonus';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO "2025-01-15 14:30"
  label?: string;
}

export interface DashboardData {
  userName: string;
  totalIndex: number;
  maxIndex: number;
  expectedBonusRub: number;
  goals: Goal[];
  transactions: Transaction[];
}

/** Курс конвертации индекса участия в рубли (мок) */
export const INDEX_TO_RUB = 75;

export const MAX_PARTICIPATION_INDEX = 1.3;
