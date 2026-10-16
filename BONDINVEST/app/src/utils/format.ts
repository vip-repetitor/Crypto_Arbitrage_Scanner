/** Форматирование денег: 1500 -> "1 500 ₽" */
export function formatRub(value: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value < 0 ? '−' : '';
  return `${sign}${formatted} ₽`;
}

/** Форматирование числа с разделителем тысяч */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

/** Индекс участия: 0.6 -> "0.6" (одна запятая-точка, tabular) */
export function formatIndex(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Значение + единица: 12, "недель" -> "12 недель" */
export function formatWithUnit(value: number, unit: string): string {
  if (unit === '₽') return formatRub(value);
  return `${formatNumber(value)} ${unit}`;
}

const WEEKDAY_SHORT: Record<string, string> = {
  Mon: 'пн', Tue: 'вт', Wed: 'ср', Thu: 'чт', Fri: 'пт', Sat: 'сб', Sun: 'вс',
};

/**
 * Относительная дата для списка транзакций.
 * Опирается на "дату сегодня" из данных (2025-01-15), чтобы мок выглядел стабильно.
 */
export function relativeDate(dateStr: string): string {
  const REFERENCE_TODAY = new Date('2025-01-15T14:30:00');
  const d = new Date(dateStr.replace(' ', 'T'));
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((REFERENCE_TODAY.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return `Сегодня ${time}`;
  if (diffDays === 1) return `Вчера ${time}`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${d.toLocaleDateString('ru-RU')} · ${WEEKDAY_SHORT[wd] ?? ''}`.trim();
}

/** Полная дата для истории: "15.01.2025" */
export function fullDate(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
