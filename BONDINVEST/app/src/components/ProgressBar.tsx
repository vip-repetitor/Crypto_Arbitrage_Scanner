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
  const pct = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  const isLocked = status === 'locked';
  const height = size === 'lg' ? 'h-4' : 'h-3';

  return (
    <div className="w-full">
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
      {isLocked && (
        <p className="mt-1 text-sm text-muted">
          🔒 Цель заблокирована — выполните предыдущие условия
        </p>
      )}
    </div>
  );
}
