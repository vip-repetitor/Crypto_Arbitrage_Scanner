import { useQuery } from '@tanstack/react-query';
import type { DashboardData, Goal, Transaction } from '../types';
import { mockBonusHistory, mockDashboard, mockGoals, mockTransactions } from '../utils/mockData';

const FAKE_LATENCY_MS = 250;

/** Мок-«загрузка» данных дашборда через React Query */
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

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
}

export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: fetchGoals });
}

export function useGoal(id: string | undefined) {
  const { data, isLoading, error } = useGoals();
  return {
    goal: data?.find((g) => g.id === id) ?? null,
    isLoading,
    error,
  };
}

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

export function useBonusHistory() {
  return useQuery({ queryKey: ['bonus-history'], queryFn: fetchBonusHistory });
}
