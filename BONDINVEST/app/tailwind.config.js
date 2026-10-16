/** @type {import('tailwindcss').Config} */
// Конфиг дизайн-токенов BONDINVEST (палитра/тени/анимации из ТЗ).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Семантические цвета: brand (основное действие), success (прогресс),
      // gold (бонусы/достижения), ink/muted/line/surface (нейтральная типографика)
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          hover: '#3B82F6',
          soft: '#DBEAFE',
        },
        success: {
          DEFAULT: '#16A34A',
          bright: '#22C55E',
          soft: '#DCFCE7',
        },
        gold: {
          DEFAULT: '#CA8A04',
          bright: '#EAB308',
          soft: '#FEF9C3',
        },
        ink: '#0F172A',
        muted: '#475569',
        line: '#CBD5E1',
        surface: '#F8FAFC',
        danger: {
          DEFAULT: '#DC2626',
          soft: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08)',
        'card-hover': '0 12px 24px rgba(15, 23, 42, 0.12)',
      },
      keyframes: {
        // Мягкое пульсирующее свечение карточки цели с прогрессом >80%
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0.0)' },
          '50%': { boxShadow: '0 0 0 6px rgba(37, 99, 235, 0.25)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
