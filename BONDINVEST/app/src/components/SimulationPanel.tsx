/**
 * SimulationPanel.tsx — тестовая панель «рандомного пользователя».
 * Встраивается в Dashboard справа снизу (fixed) и позволяет:
 *   - "Шаг" — совершить одно случайное действие (депозит/удержание/вывод);
 *   - "Пуск/Стоп" — включить автосимуляцию (каждые 1.5с новое действие);
 *   - "Сброс" — вернуть состояние к исходному моку из ТЗ;
 * статус-строка показывает счётчик шагов и последнее действие.
 * Все данные приходят через useSimulation → React Query, поэтому цели,
 * индекс и транзакции на экране оживают без перезагрузки страницы.
 */
import { SIM_SPEEDS, useSimulation } from '../hooks/useSimulation';

/** Компонент не принимает пропсов — всё поведение инкапсулировано в хуке. */
export function SimulationPanel() {
  const sim = useSimulation();

  return (
    <aside
      aria-label="Тестовая симуляция действий пользователя"
      className="w-full rounded-3xl border border-line/70 bg-white p-4 shadow-premium lg:w-80"
    >
      {/* Заголовок панели + живой индикатор режима */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">🧪 Тест-симулятор</h2>
        <span
          className={
            'inline-block h-2.5 w-2.5 rounded-full ' + (sim.running ? 'animate-pulse bg-success' : 'bg-line')
          }
          aria-hidden="true"
        />
      </div>

      {/* Статус-строка: озвучивается скринридером при каждом обновлении данных */}
      <p role="status" aria-live="polite" className="mb-3 min-h-[2.5rem] text-xs text-muted">
        Шагов: <strong className="tabular-nums text-ink">{sim.steps}</strong>
        <br />
        {sim.lastActionText ? `Последнее: ${sim.lastActionText}` : 'Действий пока нет'}
      </p>

      {/* Выбор скорости автосимуляции: сегменты ×1 / ×4 / ×10 (по умолчанию ×4) */}
      <div role="group" aria-label="Скорость симуляции" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
        {SIM_SPEEDS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={sim.speedIndex === i}
            onClick={() => sim.setSpeedIndex(i)}
            className={
              'rounded-lg py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ' +
              (sim.speedIndex === i ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-line/40')
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Управление: три кнопки, доступны с клавиатуры (обычные <button>) */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={sim.stepOnce}
          disabled={sim.running}
          className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Шаг
        </button>
        <button
          type="button"
          onClick={sim.toggleAutoplay}
          className={
            'flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ' +
            (sim.running ? 'bg-danger hover:bg-danger/90' : 'bg-success hover:bg-success/90')
          }
        >
          {sim.running ? 'Стоп' : 'Пуск'}
        </button>
        <button
          type="button"
          onClick={sim.reset}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted transition hover:bg-line/40"
        >
          Сброс
        </button>
      </div>
    </aside>
  );
}
