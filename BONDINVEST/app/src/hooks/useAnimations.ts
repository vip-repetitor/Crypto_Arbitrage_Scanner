/**
 * useAnimations.ts — общий «движок» анимаций приложения.
 * Содержит: хук счётчика чисел (useCountUp), готовые варианты framer-motion
 * (появление карточек, тост, «поп» иконки) и генератор звука успеха на WebAudio.
 * Вынесено в один модуль, чтобы все компоненты использовали одинаковые
 * тайминги из ТЗ (600ms прогресс, 800ms счётчик, 400ms тост и т.д.).
 */
import { useEffect, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';

/**
 * Счётчик числа от 0 до target за durationMs (по умолчанию 800ms) — для индекса/баланса.
 * Как это работает:
 * - requestAnimationFrame даёт плавную покадровую анимацию синхронно с частотой экрана;
 * - t = прошедшая доля времени (0..1); eased = ease-out cubic: быстрый старт, мягкое торможение;
 * - setValue перерисовывает компонент каждый кадр с новым значением;
 * - очистка cancelAnimationFrame при размонтировании/смене target предотвращает
 *   утечку кадров и «гонку» старых анимаций с новыми.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs); // прогресс 0..1, обрезаем на конце
      // ease-out cubic: 1 - (1-t)^3 — старт быстро, финиш плавно
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

/** Общий вариант появления карточек: выезд снизу + fade-in, 400ms (ТЗ: «уведомление всплывает снизу 400ms»). */
export const cardAppear: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/** Вариант тоста достижений: скрыт (снизу, чуть уменьшен) → видим → уход вниз при закрытии. */
export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 48, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  exit: { opacity: 0, y: 24, transition: { duration: 0.25, ease: 'easeIn' } },
};

/** Масштабирование иконки достижения 1 → 1.2 → 1 за 300ms (ключевые кадры в массиве scale). */
export const iconPop: Variants = {
  hidden: { scale: 1 },
  visible: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3, delay: 0.15, ease: 'easeOut' },
  },
};

/**
 * Звук успеха — короткий «колокольчик» (~0.5s) синтезируется WebAudio,
 * без внешних аудиофайлов (легче бандл, нет CORS/загрузок).
 * Логика: два осциллятора (A5=880Гц, D6≈1174.66Гц) стартуют с шагом 120ms —
 * получается восходящий мажорный интервал. Огибающая gain: тишина → громкость 0.2
 * за 20ms → экспоненциальное затухание за 500ms (экспонента нужна, т.к.
 * линейное затухание до 0 WebAudio запрещён). Контекст закрывается по таймауту,
 * чтобы не копить ресурсы. try/catch: звук опционален — в средах без AudioContext
 * (SSR, тесты) просто ничего не происходит.
 */
export function playSuccessChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.5);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* звук опционален — тихо игнорируем */
  }
}
