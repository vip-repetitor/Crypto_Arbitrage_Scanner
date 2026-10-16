/**
 * types.ts — единый источник типов предметной области BONDINVEST.
 * Логика приложения построена вокруг трёх сущностей: Goal (цель участия),
 * Transaction (финансовая операция) и DashboardData (агрегированный ответ «бэкенда»).
 */

/**
 * Статус цели для UI. Соответствует состояниям прогресс-бара из ТЗ:
 * - empty      — пользователь ещё не начал выполнять условие (0%);
 * - in_progress— прогресс есть, но порог не достигнут;
 * - achieved   — первый порог достигнут, бонус разблокирован;
 * - locked     — цель недоступна (не выполнены предыдущие условия).
 */
export type GoalStatus = 'empty' | 'in_progress' | 'achieved' | 'locked';

/** Семантические цвета заполнения прогресс-бара (маппятся на токены Tailwind). */
export type ProgressBarColor = 'brand' | 'success' | 'gold';

/**
 * Порог (ступень) цели: при достижении `value` начисляется `bonus` к индексу.
 * У каждой цели два порога (напр. 8 и 20 недель), поэтому Threshold[] описывает
 * многоуровневую систему «До следующего уровня».
 */
export interface Threshold {
  /** Пороговое значение (в единицах цели) */
  value: number;
  /** Бонус к индексу при достижении порога */
  bonus: number;
}

/**
 * Цель участия — центральная сущность.
 * `current/target` дают базовый прогресс-бар, `thresholds` — детальные уровни,
 * `steps` — инструкция «Как достичь» на странице деталей.
 */
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

/** Тип транзакции: пополнение / вывод / начисление бонуса. */
export type TransactionType = 'deposit' | 'withdraw' | 'bonus';

/**
 * Одна финансовая операция в истории.
 * Сумма со знаком: положительные — зачисления, отрицательные — списания.
 */
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // формат "2025-01-15 14:30"
  label?: string;
}

/**
 * Полный ответ дашборда: имитирует один REST-запрос, которым сервер
 * возвращает все данные главного экрана разом (индекс + цели + транзакции).
 */
export interface DashboardData {
  userName: string;
  totalIndex: number;
  maxIndex: number;
  expectedBonusRub: number;
  goals: Goal[];
  transactions: Transaction[];
}

/** Курс конвертации индекса участия в рубли (мок): 1.0 индекса ≈ 75 ₽/год. */
export const INDEX_TO_RUB = 75;

/** Теоретический максимум индекса: сумма всех максимальных бонусов целей (0.5+0.4+0.3≈1.3). */
export const MAX_PARTICIPATION_INDEX = 1.3;
