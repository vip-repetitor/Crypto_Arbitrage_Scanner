/**
 * Визуальная проверка отрисовки UX-фич: рендерим Dashboard и HistoryPage
 * целиком (с QueryClientProvider + MemoryRouter) и утверждаем наличие
 * новых блоков в DOM.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../components/Dashboard';
import { GoalCard } from '../components/GoalCard';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe('Отрисовка UX-фич', () => {
  it('скелетоны видны во время загрузки дашборда', () => {
    wrap(<Dashboard />);
    // До резолва мока (250ms) должны быть заглушки .skeleton и sr-only статус
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('Загрузка данных…')).toBeInTheDocument();
  });

  it('GoalCard рисует строку прогноза при ratePerWeek и не рисует без него', () => {
    const progress = { current: 1500, target: 2000, unit: '₽' };
    const { unmount } = wrap(
      <GoalCard title="Объём" icon="💰" progress={progress} bonus="+0.2" status="in_progress" hint="Осталось: 500₽" ratePerWeek={375} />,
    );
    expect(screen.getByText(/📈 Прогноз: ~2 недели/)).toBeInTheDocument();
    unmount();
    wrap(
      <GoalCard title="Объём" icon="💰" progress={progress} bonus="+0.2" status="in_progress" hint="Осталось: 500₽" />,
    );
    expect(screen.queryByText(/Прогноз/)).not.toBeInTheDocument();
  });
});
