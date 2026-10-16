import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// WebAudio недоступен в jsdom — заглушаем звук успеха
Object.defineProperty(window, 'AudioContext', {
  value: vi.fn().mockImplementation(() => ({
    currentTime: 0,
    createOscillator: () => ({
      type: '',
      frequency: { value: 0 },
      connect: () => ({ connect: () => undefined }),
      start: () => undefined,
      stop: () => undefined,
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => ({ connect: () => undefined }),
    }),
    destination: {},
    close: () => undefined,
  })),
  writable: true,
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
