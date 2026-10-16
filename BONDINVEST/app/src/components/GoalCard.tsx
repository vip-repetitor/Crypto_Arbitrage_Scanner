/**
 * GoalCard.tsx — карточка одной цели на дашборде (см. макет «ВАШИ ЦЕЛИ»).
 * Состав: иконка + заголовок, бейдж статуса, ProgressBar, бонус, подсказка hint.
 *
 * Логика взаимодействия:
 * - карточка реализована как div role="button" tabIndex=0: клик мышью или
 *   Enter/Space с клавиатуры вызывают onClick (навигация на /goal/:id);
 * - единая aria-label озвучивает скринридеру всю суть карточки одним чтением;
 * - hover: подъём y:-4 через framer-motion + усиление тени (CSS transition 200ms);
 * - если shouldPulse(...) истинно (in_progress и >80%) — добавляется CSS-класс
 *   animate-pulseGlow (мягкое свечение, keyframes в index.css).
 */
import { motion } from 'framer-motion';
import type { Goal, ProgressBarColor } from '../types';
import { goalPercent, shouldPulse } from '../utils/calculations';
import { formatWithUnit } from '../utils/format';
import { ProgressBar } from './ProgressBar';
import { cardAppear } from '../hooks/useAnimations';

interface GoalCardProps {
  title: string;
  icon: string;
  progress: Pick<Goal, 'current' | 'target' | 'unit'>;
  bonus: string;
  status: Goal['status'];
  hint: string;
  color?: ProgressBarColor;
  onClick?: () => void;
}

/**
 * Таблица отображения статусов: текст бейджа + цветовые классы.
 * Каждый статус содержит эмодзи-маркер (✓/🔄/○/🔒) — информация о состоянии
 * не зависит только от цвета (требование доступности для цветовой слепоты).
 */
const STATUS_META: Record<Goal['status'], { label: string; cls: string }> = {
  achieved: { label: '✓ Разблокировано', cls: 'text-gold bg-gold-soft' },
  in_progress: { label: '🔄 В процессе', cls: 'text-success bg-success-soft' },
  empty: { label: '○ Не начато', cls: 'text-muted bg-slate-100' },
  locked: { label: '🔒 Заблокировано', cls: 'text-muted bg-slate-100' },
};

/**
 * GoalCard — карточка цели: иконка, прогресс-бар, бонус, статус, подсказка.
 * Клик (или Enter/Space) открывает детали цели.
 */
export function GoalCard({
  title,
  icon,
  progress,
  bonus,
  status,
  hint,
  color = 'brand',
  onClick,
}: GoalCardProps) {
  const meta = STATUS_META[status];
  // shouldPulse требует полный объект Goal, а карточка получает только его «срез» —
  // достраиваем минимальный объект-заглушку: важны лишь status/current/target/unit.
  const pulse = shouldPulse({
    id: '',
    title: '',
    icon: '',
    unit: progress.unit,
    current: progress.current,
    target: progress.target,
    bonus: '',
    status,
    hint: '',
    thresholds: [],
    description: '',
    steps: [],
  });

  return (
    <motion.div
      variants={cardAppear}          // появление снизу+fade при монтировании списка
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4 }}         // микровзаимодействие: поднятие карточки на hover
      role="button"                  // интерактивная карточка доступна скринридерам
      tabIndex={0}                   // и gets фокус по Tab (клавиатурная навигация)
      aria-label={`Цель «${title}». ${meta.label}. Прогресс ${goalPercent(progress)}%. ${hint}`}
      onClick={onClick}
      onKeyDown={(e) => {
        // Эмуляция «нативной кнопки»: Enter/Space активируют клик
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // Space иначе скроллит страницу
          onClick?.();
        }
      }}
      className={`cursor-pointer rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        pulse ? 'animate-pulseGlow' : ''
      }`}
    >
      {/* Шапка: иконка (декоративная, скрыта от AT) + название + бейдж статуса */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <span aria-hidden="true" className="text-xl">
            {icon}
          </span>
          {title.toUpperCase()}
        </h3>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}
        >
          {meta.label}
        </span>
      </div>

      {/* Прогресс-бар: подпись вида «1 500 ₽ / 2 000 ₽» формируется форматтером */}
      <ProgressBar
        current={progress.current}
        target={progress.target}
        color={color}
        status={status}
        label={`${formatWithUnit(progress.current, progress.unit)} / ${formatWithUnit(
          progress.target,
          progress.unit,
        )}`}
        ariaLabel={`Прогресс цели ${title}`}
      />

      {/* Бонус к индексу — золотым, tabular-nums для стабильной ширины цифр */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <p className="font-medium text-muted">
          Бонус: <span className="font-bold tabular-nums text-gold">{bonus}</span> к индексу
        </p>
      </div>
      {/* Подсказка: «Осталось X» / «До следующего уровня» / «Бонус активен!» */}
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </motion.div>
  );
}
