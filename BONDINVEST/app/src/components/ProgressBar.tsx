/**
 * ProgressBar.tsx — базовый визуальный компонент: анимированный, доступный прогресс-бар.
 * Используется во всех экранах (карточки целей, индекс участия, страница деталей).
 *
 * Логика работы:
 * 1. Процент = current/target с двусторонним ограничением [0..100]: переполнение
 *    (4/3 пополнения) не «вылезает» за трек, отрицательные значения невозможны;
 *    target<=0 → 0% (защита от деления на ноль).
 * 2. Анимация заполнения — framer-motion: initial width 0 → animate width pct%
 *    за ровно 600ms ease-out (требование ТЗ). При каждом изменении current
 *    фреймворк интерполирует ширину от текущего значения к новому.
 * 3. Доступность: контейнер имеет role="progressbar" + полный набор ARIA
 *    (aria-valuenow/min/max/valuetext) — скринридер озвучивает «Прогресс 75%».
 *    Проценты рядом aria-hidden, чтобы не дублировать чтение.
 * 4. Состояния: locked — серый фон трека/заливки + текстовая подпись 🔒
 *    (не полагаемся только на цвет); empty/in_progress/achieved различаются
 *    цветом color-пропса и подписью статуса снаружи (в GoalCard).
 */
import { motion } from 'framer-motion';
import type { GoalStatus, ProgressBarColor } from '../types';

interface ProgressBarProps {
  current: number;
  target: number;
  color?: ProgressBarColor;
  status?: GoalStatus;
  /** Подпись слева над баром, напр. "12/20 недель" */
  label?: string;
  /** ARIA-метка для скринридера */
  ariaLabel: string;
  size?: 'md' | 'lg';
}

/** Маппинг семантического цвета на Tailwind-класс заливки (токены заданы в tailwind.config.js). */
const FILL_COLORS: Record<ProgressBarColor, string> = {
  brand: 'bg-brand',
  success: 'bg-success',
  gold: 'bg-gold',
};

/**
 * ProgressBar — доступный анимированный прогресс-бар.
 * Анимация заполнения: 600ms ease-out.
 * Состояния: Empty / In Progress / Achieved / Locked.
 */
export function ProgressBar({
  current,
  target,
  color = 'brand',
  status = 'in_progress',
  label,
  ariaLabel,
  size = 'md',
}: ProgressBarProps) {
  // Шаг 1: нормализуем прогресс в проценты с клампингом [0..100]
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  const isLocked = status === 'locked';
  const height = size === 'lg' ? 'h-4' : 'h-3';

  return (
    <div className="w-full">
      {/* Верхняя строка: подпись «12/20 недель» слева и процент справа.
          Скрывается целиком только у заблокированного бара без label. */}
      {(label || !isLocked) && (
        <div className="mb-1 flex items-baseline justify-between">
          {label && (
            <span className="text-sm font-semibold tabular-nums text-ink">{label}</span>
          )}
          <span
            className={`ml-auto text-sm font-semibold tabular-nums ${
              isLocked ? 'text-muted' : 'text-muted'
            }`}
            aria-hidden="true"
          >
            {Math.round(pct)}%
          </span>
        </div>
      )}
      {/* Трек: семантический progressbar со всеми обязательными ARIA из ТЗ.
          aria-valuetext даёт человекочитаемую фразу вместо «голых» чисел. */}
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={Math.round(current)}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuetext={
          isLocked
            ? `${ariaLabel}: цель заблокирована`
            : `Прогресс ${Math.round(pct)}%: ${label ?? ''}`.trim()
        }
        className={`w-full overflow-hidden rounded-full ${
          isLocked ? 'bg-line/60' : 'bg-slate-100 bg-[#E2E8F0]'
        } ${height}`}
      >
        {/* Заливка: шаг 2 — анимация ширины 600ms ease-out (ТЗ).
            data-testid используется юнит-тестами для проверки процента. */}
        <motion.div
          data-testid="progress-fill"
          className={`${height} rounded-full ${
            isLocked ? 'bg-line' : FILL_COLORS[color]
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {/* Состояние Locked: текстовое пояснение — статус передаётся не только цветом (a11y) */}
      {isLocked && (
        <p className="mt-1 text-sm text-muted">
          🔒 Цель заблокирована — выполните предыдущие условия
        </p>
      )}
    </div>
  );
}
