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
  /**
   * UX-фича «прогноз»: средний прирост цели в единицах за неделю
   * (напр. +350₽/нед по объёму). Опционально: если данных о темпе нет,
   * блок прогноза скрывается (forecastWeeks вернёт null).
   */
  ratePerWeek?: number;
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

/**
 * Курс конвертации индекса участия в рубли: 1.0 индекса ≈ 75 ₽/год на 1000₽.
 * Аудит 2026-10: значение синхронизируется с Python-моделью (model/config.yaml,
 * rub_per_index_point) — при расхождении запускается parity-тест modelParity.test.ts,
 * который «краснеет» и не даёт выкатить несогласованный фронт.
 */
export const INDEX_TO_RUB = 75;

/** Теоретический максимум индекса: base(0.1) + 0.5 + 0.4 + 0.3 = 1.3 (см. config.yaml). */
export const MAX_PARTICIPATION_INDEX = 1.3;

/**
 * Сколько п.п. годовых даёт 1.0 индекса участия. ВНИМАНИЕ (фикс бага аудита
 * 2026-10): rate ₽/год на базе 1000₽ — это НЕ rate/100 п.п., потому что
 * модель продукта нормирует бонус на 1000₽ иначе: source of truth — Python
 * model.py user_yield_pct: bonus_pp = index * rub_per_index_point / 10.
 * При дефолтном rate=75 => 7.5 п.п. на 1.0 индекса (индекс 0.6 -> 8.5% годовых,
 * индекс 0.8 -> 10% — совпадает с маркетинговым «до 10%»).
 * Паритет с model.py жёстко контролирует modelParity.test.ts.
 */
export const YIELD_PP_PER_INDEX = INDEX_TO_RUB / 10;
/** Гарантированная база продукта («4% годовых», купон ОФЗ) — паритет с model.py. */
export const GUARANTEED_YIELD_PCT = 4;
