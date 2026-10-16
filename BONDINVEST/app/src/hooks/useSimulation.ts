/**
 * useSimulation.ts — мост между «виртуальным пользователем» (utils/simulation)
 * и React-деревом. Логика работы:
 *
 * 1. При включении симуляции создаётся экземпляр createSimulation(mockDashboard)
 *    — стартовое состояние точно такое же, как у реального мока из ТЗ.
 * 2. setInterval с выбранным интервалом вызывает applyRandomAction(): генерируется
 *    случайное действие (депозит/удержание/вывод), пересчитываются цели и индекс.
 * 3. Полученный снимок (SimSnapshot) записывается в кэш React Query через
 *    queryClient.setQueryData под ключами ['goals'], ['dashboard'], ['transactions'] —
 *    те же ключи читают useGoals/useDashboard/useTransactions, поэтому Dashboard,
 *    GoalDetails и HistoryPage мгновенно перерисовываются без единого «сетевого» запроса.
 * 4. Если действие пересекло порог цели, simulation дёргает подписчика → мы собираем
 *    AchievementInfo (цель, бонус в ₽, текст следующего уровня) и показываем
 *    AchievementToast с конфетти и звуком — ровно как при реальном достижении.
 * 5. Останов/выгрузка очищают интервал и отписку (cleanup), утечек нет.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardData, Goal } from '../types';
import { INDEX_TO_RUB } from '../types';
import { indexToRub, nextThreshold } from '../utils/calculations';
import { mockDashboard } from '../utils/mockData';
import { createSimulation, type Simulation } from '../utils/simulation';
import type { AchievementInfo } from '../components/AchievementToast';

/** Интервал автоповтора шага симуляции, мс (выбран так, чтобы анимация 600ms успевала проиграться). */
const AUTOPLAY_INTERVAL_MS = 1500;

/** Публичный API хука для компонента SimulationPanel. */
export interface SimulationApi {
  /** Включена ли автосимуляция сейчас */
  running: boolean;
  /** Сколько действий совершил виртуальный пользователь за сессию */
  steps: number;
  /** Последнее сгенерированное действие (для отображения «что сделал пользователь») */
  lastActionText: string | null;
  /** Активное достижение для AchievementToast (null — тост скрыт) */
  achievement: AchievementInfo | null;
  /** Разовый шаг: одно случайное действие (ручной режим) */
  stepOnce: () => void;
  /** Переключить автосимуляцию (on → старт интервала, off → остановка) */
  toggleAutoplay: () => void;
  /** Сброс: остановить и вернуть состояние к исходному моку ТЗ */
  reset: () => void;
  /** Закрыть тост достижения (передаётся в AchievementToast onDismiss) */
  dismissAchievement: () => void;
}

/**
 * Собирает AchievementInfo из цели, порог которой только что пересечён.
 * bonusRub: бонус порога × курс индекса; nextLevelText: «до какого значения следующий порог».
 */
function buildAchievement(goal: Goal, thresholdValue: number): AchievementInfo {
  const threshold = goal.thresholds.find((t) => t.value === thresholdValue);
  const upcoming = nextThreshold(goal.thresholds, goal.current);
  return {
    goal,
    bonusRub: indexToRub(threshold?.bonus ?? 0, INDEX_TO_RUB),
    nextLevelText: upcoming ? `${upcoming.value} ${goal.unit}` : null,
  };
}

/**
 * @param initial — базовый мок (по умолчанию mockDashboard из ТЗ); параметризуется
 * для тестов, чтобы проверить детерминированное поведение на фиксированных данных.
 */
export function useSimulation(initial: DashboardData = mockDashboard): SimulationApi {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(0);
  const [lastActionText, setLastActionText] = useState<string | null>(null);
  const [achievement, setAchievement] = useState<AchievementInfo | null>(null);

  // Экземпляр симуляции живёт в ref: не пересоздаётся при ререндерах,
  // но доступен из колбэков setInterval без «устаревших замыканий».
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) simRef.current = createSimulation(initial);

  /**
   * Запись снимка в кэш React Query. Ключ ['dashboard'] перезаписывается целиком
   * (сохраняем userName/maxIndex из оригинального мока), ['goals'] и
   * ['transactions'] — частично, если страницы уже держат эти ключи в кэше.
   */
  const publish = useCallback(
    (snapshot: ReturnType<Simulation['getSnapshot']>, actionText: string | null) => {
      queryClient.setQueryData<DashboardData>(['dashboard'], (prev) => ({
        userName: prev?.userName ?? initial.userName,
        maxIndex: prev?.maxIndex ?? initial.maxIndex,
        totalIndex: snapshot.totalIndex,
        expectedBonusRub: snapshot.expectedBonusRub,
        goals: snapshot.goals,
        transactions: snapshot.transactions,
      }));
      // Обновляем отдельные кэши только если они уже существуют (страница открыта):
      // иначе следующий fetch вернёт свежий мок, а не «полунравшийся» снапшот.
      queryClient.getQueryData(['goals']) && queryClient.setQueryData(['goals'], snapshot.goals);
      queryClient.getQueryData(['transactions']) &&
        queryClient.setQueryData(['transactions'], snapshot.transactions);
      setLastActionText(actionText);
      setSteps((n) => n + 1);
    },
    [queryClient, initial],
  );

  /** Один шаг: применить случайное действие → опубликовать результат. */
  const doStep = useCallback(() => {
    const sim = simRef.current!;
    // Подписка ставится на каждый шаг, чтобы поймать именно то действие,
    // которое пересекло порог; сразу после вызова — отписка (без дублей слушателей).
    const crossed: Array<{ goal: Goal; value: number }> = [];
    const unsubscribe = sim.subscribe((goal, value) => crossed.push({ goal, value }));
    const snapshot = sim.applyRandomAction();
    unsubscribe();
    // Текст последнего действия восстановим из первой транзакции снимка.
    const tx = snapshot.transactions[0];
    publish(snapshot, tx ? tx.label ?? tx.type : null);
    // Первое пересечение порога за шаг → тост (обычно их не больше одного).
    if (crossed.length > 0) {
      setAchievement(buildAchievement(crossed[0].goal, crossed[0].value));
    }
  }, [publish]);

  const stepOnce = useCallback(() => doStep(), [doStep]);

  /**
   * Автосимуляция: пока running === true, заводим интервал и делаем первый шаг
   * сразу (иначе пользователь ждёт 1.5с после нажатия «Пуск»). Cleanup гасит
   * интервал при выключении/размонтировании — двойных таймеров StrictMode не создаст,
   * т.к. эффект идемпотентен (интервал хранится локально в замыкании эффекта).
   */
  useEffect(() => {
    if (!running) return;
    doStep();
    const id = setInterval(doStep, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, doStep]);

  /** Сброс: удаляем экземпляр и все кэши — страницы заново загрузят чистый мок ТЗ. */
  const reset = useCallback(() => {
    setRunning(false);
    setSteps(0);
    setLastActionText(null);
    setAchievement(null);
    simRef.current = createSimulation(initial);
    queryClient.removeQueries({ queryKey: ['dashboard'] });
    queryClient.removeQueries({ queryKey: ['goals'] });
    queryClient.removeQueries({ queryKey: ['transactions'] });
  }, [queryClient, initial]);

  return {
    running,
    steps,
    lastActionText,
    achievement,
    stepOnce,
    toggleAutoplay: () => setRunning((r) => !r),
    reset,
    dismissAchievement: () => setAchievement(null),
  };
}
