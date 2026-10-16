/**
 * modelParity.test.ts — аудит паритета математических моделей (2026-10).
 *
 * Смысл: финансовая логика живёт в двух местах — Python-модель (source of truth,
 * BONDINVEST/model/config.yaml + model.py) и TypeScript-расчёты фронта.
 * Эти тесты «сшивают» их константами и формулами: если кто-то поменяет веса
 * в YAML и забудет перегенерировать фронт — тест упадёт красным, а не тихо
 * разойдётся на проде. Проверяются три слоя:
 *   1) пороги/бонусы из generated/model-config.json == моки фронта;
 *   2) курс индекса в рубли и максимум индекса == значения модели;
 *   3) доходность лидераборда == yield по формуле user_yield_pct(model.py).
 */
import { describe, it, expect } from 'vitest';
import modelConfig from '../generated/model-config.json';
import { mockGoals, mockDashboard } from '../utils/mockData';
import { INDEX_TO_RUB, MAX_PARTICIPATION_INDEX, GUARANTEED_YIELD_PCT } from '../types';
import { sumGoalBonus, indexToRub } from '../utils/calculations';
import { yieldForIndex, YIELD_PP_PER_INDEX, BASE_YIELD_PCT } from '../utils/leaderboard';

describe('Паритет фронта с Python-моделью (config.yaml)', () => {
  it('пороги и бонусы целей идентичны сгенерированному конфигу', () => {
    for (const cfgGoal of modelConfig.goals) {
      const uiGoal = mockGoals.find((g) => g.id === cfgGoal.id);
      expect(uiGoal, `цель ${cfgGoal.id} есть в моке фронта`).toBeTruthy();
      // Сравниваем пары (value, bonus) — порядок порогов в обеих моделях возрастание
      expect(uiGoal!.thresholds.map((t) => [t.value, t.bonus])).toEqual(
        cfgGoal.thresholds.map((t) => [t.value, t.bonus]),
      );
    }
  });

  it('константы курса и максимума индекса совпадают с моделью', () => {
    expect(INDEX_TO_RUB).toBe(modelConfig.rubPerIndexPoint);
    expect(MAX_PARTICIPATION_INDEX).toBe(modelConfig.maxIndex);
    // Максимум действительно = base + сумма лучших бонусов всех целей
    const bestSum = modelConfig.goals.reduce(
      (acc, g) => acc + Math.max(...g.thresholds.map((t) => t.bonus)),
      modelConfig.baseIndex,
    );
    expect(bestSum).toBeCloseTo(modelConfig.maxIndex, 10);
  });

  it('мок-индекс пользователя воспроизводится формулой модели (base + Σбонусов)', () => {
    // model.py: total = round(base + Σ достигнутых бонусов, 2). Тот же расчёт на фронте:
    const computed = +(modelConfig.baseIndex + sumGoalBonus(mockGoals)).toFixed(2);
    expect(computed).toBe(mockDashboard.totalIndex); // 0.1+0.3+0+0.2 = 0.6
    // И перевод в рубли: expectedBonusRub == index * rate (округление до 0.1 ₽)
    expect(indexToRub(mockDashboard.totalIndex, INDEX_TO_RUB)).toBe(mockDashboard.expectedBonusRub);
  });

  it('доходность лидерборда == user_yield_pct(model.py): 4% + index*rate/100', () => {
    // Эталон из model.py user_yield_pct: yield = 4 + index * rate / 100,
    // где rate = rub_per_index_point (75 ₽/год на 1000₽ => 0.75 п.п. на 1.0 индекса).
    const pyLike = (index: number) => +(GUARANTEED_YIELD_PCT + (index * modelConfig.rubPerIndexPoint) / 100).toFixed(2);
    expect(YIELD_PP_PER_INDEX).toBeCloseTo(modelConfig.rubPerIndexPoint / 100, 10);
    expect(BASE_YIELD_PCT).toBe(GUARANTEED_YIELD_PCT);
    for (const idx of [0.1, 0.6, 0.8, 1.3]) {
      expect(yieldForIndex(idx)).toBe(pyLike(idx));
    }
    // Контрольные точки модели: мок 0.6 -> 8.5%, «до 10%» достигается при 0.8
    expect(yieldForIndex(0.6)).toBe(8.5);
    expect(yieldForIndex(0.8)).toBe(10);
  });
});
