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
        // Премиальные слои (Т-Банк/казино-лайфхаки): мягкая «воздушная» тень плиток
        premium: '0 8px 32px rgba(15, 23, 42, 0.08)',
        'premium-hover': '0 16px 48px rgba(15, 23, 42, 0.14)',
        gold: '0 8px 28px rgba(202, 138, 4, 0.22)',
      },
      backgroundImage: {
        // Тёмный градиент hero-плитки (премиум-ощущение, как в инвест-профилях банков)
        hero: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #1D4ED8 130%)',
        // Золотая кромка для акцентов «разблокировано/бонус»
        golddim: 'linear-gradient(135deg, rgba(234,179,8,0.16), rgba(234,179,8,0.04))',
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
