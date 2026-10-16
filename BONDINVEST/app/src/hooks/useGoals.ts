/**
 * useGoals.ts — слой доступа к данным на React Query.
 * Логика: каждая fetch-функция имитирует HTTP-запрос (sleep 250ms) и возвращает
 * мок из utils/mockData. Хуки объявляют queryKey — ключ кэша; повторные вызовы
 * с тем же ключом берут данные из кэша (staleTime настроен в main.tsx),
 * поэтому переход Dashboard → GoalDetails не ждёт загрузку заново.
 * При замене мока на реальный API менять только тела fetch-функций.
 */
import { useQuery } from '@tanstack/react-query';
import type { DashboardData, Goal, Transaction } from '../types';
import { mockBonusHistory, mockDashboard, mockGoals, mockTransactions } from '../utils/mockData';

/** Искусственная задержка «сети», чтобы состояния загрузки были видны в демо. */
const FAKE_LATENCY_MS = 250;

/** Мок-«загрузка» данных дашборда через React Query (один запрос = весь экран). */
async function fetchDashboard(): Promise<DashboardData> {
  await new Promise((r) => setTimeout(r, FAKE_LATENCY_MS));
  return mockDashboard;
}

async function fetchGoals(): Promise<Goal[]> {
  await new Promise((r) => setTimeout(r, FAKE_LATENCY_MS));
  return mockGoals;
}

async function fetchTransactions(): Promise<Transaction[]> {
  await new Promise((r) => setTimeout(r, FAKE_LATENCY_MS));
  return mockTransactions;
}

async function fetchBonusHistory(): Promise<Transaction[]> {
  await new Promise((r) => setTimeout(r, FAKE_LATENCY_MS));
  return mockBonusHistory;
}

/** Полный агрегированный ответ дашборда для главного экрана. */
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
}

/** Список всех целей; кэшируется под ключом ['goals'] и переиспользуется useGoal. */
export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: fetchGoals });
}

/**
 * Одна цель по id. Не делает отдельного запроса: берёт список из общего кэша
 * ['goals'] и фильтрует локально — так /goal/:id мгновенно открывается после дашборда.
 * Возвращает goal === null, если id не найден (страница покажет «Цель не найдена»).
 */
export function useGoal(id: string | undefined) {
  const { data, isLoading, error } = useGoals();
  return {
    goal: data?.find((g) => g.id === id) ?? null,
    isLoading,
    error,
  };
}

/** Транзакции с опциональным ограничением количества (дашборд просит последние 5). */
export function useTransactions(limit?: number) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions,
  });
  return {
    transactions: typeof limit === 'number' ? data?.slice(0, limit) : data,
    isLoading,
    error,
  };
}

/** История бонусных выплат для страницы /history. */
export function useBonusHistory() {
  return useQuery({ queryKey: ['bonus-history'], queryFn: fetchBonusHistory });
}
