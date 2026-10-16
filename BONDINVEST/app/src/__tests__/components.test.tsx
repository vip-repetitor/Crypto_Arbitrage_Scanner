import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProgressBar } from '../components/ProgressBar';
import { GoalCard } from '../components/GoalCard';
import { runAxe } from './axeHelper';

describe('ProgressBar', () => {
  it('рендерит ARIA-атрибуты progressbar', () => {
    render(
      <ProgressBar current={12} target={20} ariaLabel="Прогресс цели Лояльность" label="12/20" />,
    );
    const bar = screen.getByRole('progressbar', { name: /Лояльность/ });
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
  });

  it('процент ограничен 100 при перевыполнении', () => {
    render(<ProgressBar current={4} target={3} ariaLabel="Активность" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('состояние Locked показывает замок и блокирует заливку', () => {
    render(<ProgressBar current={0} target={5} status="locked" ariaLabel="Заблокированная цель" />);
    expect(screen.getByText(/🔒 Цель заблокирована/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Заблокированная цель: цель заблокирована',
    );
  });

  it('проходит проверку доступности axe', async () => {
    const { container } = render(
      <ProgressBar current={75} target={100} ariaLabel="Прогресс" label="75/100" />,
    );
    await runAxe(container);
  });
});

describe('GoalCard', () => {
  const base = {
    title: 'Объём',
    icon: '💰',
    progress: { current: 1500, target: 2000, unit: '₽' },
    bonus: '+0.2',
    status: 'in_progress' as const,
    hint: 'Осталось: 500₽ до разблокировки',
  };

  it('показывает статус «В процессе» и подсказку', () => {
    render(<GoalCard {...base} />);
    expect(screen.getByText('🔄 В процессе')).toBeInTheDocument();
    expect(screen.getByText('Осталось: 500₽ до разблокировки')).toBeInTheDocument();
  });

  it('показывает «✓ Разблокировано» для achieved', () => {
    render(<GoalCard {...base} status="achieved" hint="Бонус активен!" />);
    expect(screen.getByText('✓ Разблокировано')).toBeInTheDocument();
  });

  it('клик вызывает onClick (открывает детали)', async () => {
    const onClick = vi.fn();
    render(<GoalCard {...base} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('доступна с клавиатуры: Enter активирует клик', async () => {
    const onClick = vi.fn();
    render(<GoalCard {...base} onClick={onClick} />);
    const card = screen.getByRole('button');
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('проходит проверку доступности axe', async () => {
    const { container } = render(<GoalCard {...base} onClick={() => undefined} />);
    await runAxe(container);
  });
});
