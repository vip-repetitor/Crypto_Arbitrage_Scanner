import { useEffect, useRef, useState } from 'react';
import type { Variants } from 'framer-motion';

/** Счётчик числа от 0 до target (800ms) — для баланса/индекса */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
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

/** Общий вариант появления карточек (снизу, 400ms) */
export const cardAppear: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/** Вариант тоста достижений: всплывает снизу + масштаб иконки 1 → 1.2 → 1 */
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

export const iconPop: Variants = {
  hidden: { scale: 1 },
  visible: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.3, delay: 0.15, ease: 'easeOut' },
  },
};

/** Звук успеха (короткий "колокольчик", WebAudio, без внешних файлов) */
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
