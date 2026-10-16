import type { DashboardData, Goal, Transaction } from '../types';

export const mockGoals: Goal[] = [
  {
    id: 'loyalty',
    title: 'Лояльность',
    icon: '🏅',
    current: 12,
    target: 20,
    unit: 'недель',
    bonus: '+0.3',
    status: 'achieved',
    hint: 'До следующего уровня: 8 недель',
    thresholds: [
      { value: 8, bonus: 0.3 },
      { value: 20, bonus: 0.5 },
    ],
    description: 'Непрерывное удержание средств на brokerage счёте',
    steps: [
      'Удерживайте средства на счёте без вывода',
      '8 недель подряд — разблокируется бонус +0.3',
      '20 недель подряд — максимальный бонус +0.5',
    ],
  },
  {
    id: 'volume',
    title: 'Объём',
    icon: '💰',
    current: 1500,
    target: 2000,
    unit: '₽',
    bonus: '+0.2',
    status: 'in_progress',
    hint: 'Осталось: 500₽ до разблокировки',
    thresholds: [
      { value: 2000, bonus: 0.2 },
      { value: 5000, bonus: 0.4 },
    ],
    description: 'Средний объём депозитов за расчётный период',
    steps: [
      'Пополните счёт на 500₽',
      'Удерживайте депозит 30 дней',
      'Бонус разблокируется автоматически',
    ],
  },
  {
    id: 'activity',
    title: 'Активность',
    icon: '⚡',
    current: 4,
    target: 3,
    unit: 'пополнений',
    bonus: '+0.2',
    status: 'achieved',
    hint: 'Бонус активен!',
    thresholds: [
      { value: 3, bonus: 0.2 },
      { value: 6, bonus: 0.3 },
    ],
    description: 'Количество пополнений счёта в месяц',
    steps: [
      'Пополняйте счёт регулярно',
      '3 пополнения в месяц — бонус +0.2',
      '6 пополнений в месяц — бонус +0.3',
    ],
  },
];

export const mockTransactions: Transaction[] = [
  { id: 't1', type: 'deposit', amount: 500, date: '2025-01-15 14:30', label: 'Пополнение' },
  { id: 't2', type: 'bonus', amount: 22.5, date: '2025-01-14 09:00', label: 'Бонус за лояльность' },
  { id: 't3', type: 'deposit', amount: 300, date: '2025-01-13 11:20', label: 'Пополнение' },
  { id: 't4', type: 'withdraw', amount: -100, date: '2025-01-10 16:45', label: 'Вывод на карту' },
  { id: 't5', type: 'bonus', amount: 15, date: '2025-01-05 10:00', label: 'Бонус за активность' },
];

export const mockDashboard: DashboardData = {
  userName: 'Иван',
  totalIndex: 0.6,
  maxIndex: 1.3,
  expectedBonusRub: 45,
  goals: mockGoals,
  transactions: mockTransactions,
};

/** История выплат бонусов для страницы /history */
export const mockBonusHistory: Transaction[] = [
  { id: 'b1', type: 'bonus', amount: 22.5, date: '2025-01-15 12:00', label: 'Лояльность · 8 недель удержания' },
  { id: 'b2', type: 'bonus', amount: 15, date: '2025-01-10 12:00', label: 'Объём · средний депозит 2000₽' },
  { id: 'b3', type: 'bonus', amount: 15, date: '2025-01-05 12:00', label: 'Активность · 4 пополнения за месяц' },
  { id: 'w1', type: 'withdraw', amount: -50, date: '2025-01-01 12:00', label: 'Вывод на карту' },
];
