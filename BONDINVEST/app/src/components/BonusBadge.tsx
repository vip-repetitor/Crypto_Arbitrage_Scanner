/**
 * BonusBadge.tsx — компактный бейдж бонуса (4.csv: BonusBadge).
 * Назначение: визуально «весить» бонус — чем больше прибавка к индексу,
 * тем крупнее бейдж. Состояния по ТЗ: Small (+0.2), Medium (+0.3), Large (+0.5).
 *
 * Логика выбора размера: размер НЕ задаётся вручную извне — он выводится
 * из числового значения строки бонуса ("+0.3" → 0.3):
 *   < 0.3  → small;  0.3–0.49 → medium;  >= 0.5 → large.
 * Цвет золотой (gold) — семантика «разблокированный/премиальный бонус»,
 * текст + символ «+» дублируют смысл, поэтому бейдж не зависит только от цвета.
 */
import type { Goal } from '../types';

/** Три состояния размера бейджа согласно таблице компонентов ТЗ. */
export type BadgeSize = 'small' | 'medium' | 'large';

/** Классы для каждого размера: высота/шрифт растут вместе с ценностью бонуса. */
const SIZE_CLASSES: Record<BadgeSize, string> = {
  small: 'px-2 py-0.5 text-sm',
  medium: 'px-2.5 py-1 text-base',
  large: 'px-3 py-1.5 text-lg',
};

/**
 * badgeSizeForBonus — чистая функция маппинга «значение бонуса → размер».
 * Принимает строку вида "+0.3" (формат поля Goal.bonus); нечисловые строки
 * безопасно дают 'small' (parseFloat → NaN → первое условие ложно → fallback).
 */
export function badgeSizeForBonus(bonus: string): BadgeSize {
  const value = parseFloat(bonus.replace('+', ''));
  if (!Number.isFinite(value)) return 'small';
  if (value >= 0.5) return 'large';
  if (value >= 0.3) return 'medium';
  return 'small';
}

interface BonusBadgeProps {
  /** Строка бонуса в формате Goal.bonus, например "+0.3". */
  bonus: string;
  /** Явное переопределение размера (по умолчанию — автоматически из значения бонуса). */
  size?: BadgeSize;
}

/**
 * BonusBadge — золотой бейдж «+0.X к индексу».
 * Рендерится внутри GoalCard (строка «Бонус: …») и на странице деталей цели.
 */
export function BonusBadge({ bonus, size }: BonusBadgeProps) {
  const s = size ?? badgeSizeForBonus(bonus);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gold-soft font-bold tabular-nums text-gold ${SIZE_CLASSES[s]}`}
      // Бейдж декоративен рядом с текстом «к индексу», но несёт смысл → озвучиваем как есть
      aria-label={`Бонус ${bonus} к индексу`}
    >
      {bonus}
    </span>
  );
}

/** Хелпер: бейдж прямо из объекта цели (используется GoalCard/GoalDetails). */
export function goalBonusBadge(goal: Goal): BadgeSize {
  return badgeSizeForBonus(goal.bonus);
}
