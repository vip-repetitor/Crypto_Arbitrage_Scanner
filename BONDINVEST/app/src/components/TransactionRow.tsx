import { motion } from 'framer-motion';
import type { Transaction, TransactionType } from '../types';
import { formatRub, relativeDate } from '../utils/format';

const TYPE_META: Record<TransactionType, { icon: string; title: string; amountCls: string }> = {
  deposit: { icon: '📥', title: 'Пополнение', amountCls: 'text-success' },
  withdraw: { icon: '📤', title: 'Вывод', amountCls: 'text-danger' },
  bonus: { icon: '💎', title: 'Бонус', amountCls: 'text-gold' },
};

interface TransactionRowProps {
  transaction: Transaction;
  /** Показывать относительную ("Сегодня 14:30") или полную дату */
  dateMode?: 'relative' | 'full';
}

export function TransactionRow({ transaction, dateMode = 'relative' }: TransactionRowProps) {
  const meta = TYPE_META[transaction.type];
  const isPositive = transaction.amount >= 0;
  const dateStr =
    dateMode === 'full'
      ? new Date(transaction.date.replace(' ', 'T')).toLocaleDateString('ru-RU')
      : relativeDate(transaction.date);

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between gap-3 border-b border-line/60 py-3 last:border-0"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="text-xl">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base text-ink">{transaction.label ?? meta.title}</p>
          <p className="text-sm text-muted">{dateStr}</p>
        </div>
      </div>
      <span
        className={`shrink-0 text-base font-bold tabular-nums ${meta.amountCls}`}
        aria-label={`${isPositive ? 'Плюс' : 'Минус'} ${formatRub(Math.abs(transaction.amount))}`}
      >
        {isPositive ? '+' : ''}
        {formatRub(transaction.amount)}
      </span>
    </motion.li>
  );
}
