/**
 * AchievementToast.tsx — уведомление о достижении порога + конфетти-оверлей.
 * Состав анимаций из ТЗ: 100 падающих частиц (зелёный/золотой/синий), звук
 * успеха (WebAudio), масштаб иконки 1→1.2→1, автозакрытие через 2 секунды.
 *
 * Управление: компонент «контролируемый» — родитель хранит AchievementInfo|null
 * в состоянии; появление ≠ монтирование тоста, а смена пропа на объект.
 * AnimatePresence проигрывает exit-анимацию перед реальным удалением из DOM.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import type { Goal } from '../types';
import { formatRub } from '../utils/format';
import { iconPop, playSuccessChime, toastVariants } from '../hooks/useAnimations';

/** Палитра конфетти: брендовые цвета успеха/премиума + акцентный синий. */
const CONFETTI_COLORS = ['#16A34A', '#22C55E', '#CA8A04', '#EAB308', '#2563EB'];
/** Количество частиц по ТЗ — ровно 100. */
const CONFETTI_COUNT = 100;

interface ConfettiProps {
  count?: number;
}

/**
 * Конфетти на чистом framer-motion (без lottie/canvas — меньше бандл, проще тесты).
 * Логика:
 * - useMemo генерирует N объектов-частиц со случайными параметрами ОДИН раз
 *   (иначе каждый рендер пересоздавал бы траектории и анимация «дёргалась»);
 * - каждая частица — absolutely positioned span сверху экрана (top:-4%),
 *   стартует с y:0 и летит до 105vh за 2s easeIn с индивидуальной задержкой
 *   до 0.4s (рассыпаем поток во времени), drift — боковое смещение,
 *   rotate — случайное вращение ±360°×2;
 * - контейнер pointer-events-none + fixed inset-0: не перехватывает клики;
 * - aria-hidden: decorative, AT его игнорирует (озвучку делает сам тост).
 */
function Confetti({ count = CONFETTI_COUNT }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,           // горизонтальная позиция в % ширины экрана
        delay: Math.random() * 0.4,       // стартовая задержка — эффект «залпа»
        size: 6 + Math.random() * 6,      // размер частицы 6–12px
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], // равномерная палитра
        rotate: Math.random() * 720 - 360, // полный оборот± (градусы)
        drift: Math.random() * 60 - 30,   // снос по X за время падения (px)
      })),
    [count],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-4%',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '105vh', x: p.drift, opacity: [1, 1, 0.8], rotate: p.rotate }}
          transition={{ duration: 2, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/** Данные одного достижения для отображения в тосте. */
export interface AchievementInfo {
  goal: Goal;
  bonusRub: number;
  nextLevelText: string | null;
}

interface AchievementToastProps {
  achievement: AchievementInfo | null;
  onDismiss: () => void;
  /** Включён ли звук (по умолчанию да) */
  soundEnabled?: boolean;
}

/**
 * AchievementToast — всплывающее уведомление о достижении порога:
 * конфетти (100 частиц), звук успеха, масштабирование иконки, 2 секунды показ.
 */
export function AchievementToast({
  achievement,
  onDismiss,
  soundEnabled = true,
}: AchievementToastProps) {
  // Эффект-«таймер жизни»: при появлении достижения играем звук и ставим
  // setTimeout на 2000ms для автоскрытия. Cleanup очищает таймер, если тост
  // закрыли раньше кнопкой или компонент размонтировался (нет утечек/дублей).
  useEffect(() => {
    if (!achievement) return;
    if (soundEnabled) playSuccessChime();
    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [achievement, onDismiss, soundEnabled]);

  return (
    // AnimatePresence нужен, чтобы вариант exit отыгрался ДО удаления узла
    <AnimatePresence>
      {achievement && (
        <>
          <Confetti />
          <motion.div
            role="alert"               // срочное объявление для скринридеров
            aria-live="assertive"
            variants={toastVariants}   // всплытие снизу 400ms (ТЗ)
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-gold/40 bg-white p-5 shadow-card-hover"
          >
            <div className="flex items-start gap-4">
              {/* Иконка 🎉 с эффектом «поп»: scale 1→1.2→1 за 300ms */}
              <motion.span variants={iconPop} initial="hidden" animate="visible" className="text-4xl">
                🎉
              </motion.span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-ink">Поздравляем!</h2>
                <p className="mt-0.5 text-base text-muted">
                  Вы разблокировали бонус за «{achievement.goal.title.toLowerCase()}»!
                </p>
                {/* Карточка награды: название цели, условие, бонус в индексе и рублях */}
                <div className="mt-3 rounded-xl bg-gold-soft p-3">
                  <p className="flex items-center gap-2 text-base font-semibold text-ink">
                    <span aria-hidden="true">{achievement.goal.icon}</span>
                    {achievement.goal.title.toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-muted">{achievement.goal.description}</p>
                  <p className="mt-2 text-base font-bold tabular-nums text-gold">
                    {achievement.goal.bonus} к индексу · +{formatRub(achievement.bonusRub)}
                  </p>
                </div>
                {/* Подсказка про следующий уровень (если он есть у цели) */}
                {achievement.nextLevelText && (
                  <p className="mt-3 text-sm text-muted">{achievement.nextLevelText}</p>
                )}
                <button
                  type="button"
                  onClick={onDismiss}
                  className="mt-3 w-full rounded-xl bg-brand px-4 py-2 text-base font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  Продолжить
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
