/**
 * format.ts — функции форматирования вывода (деньги, числа, индекс, даты).
 * Вся локализация (ru-RU) собрана здесь, чтобы компоненты не дублировали
 * правила Intl и легко менялись в одном месте. Чистые функции, покрыты тестами.
 */

/**
 * Форматирование денег: 1500 → "1 500 ₽", -100 → "−100 ₽".
 * Берём модуль числа и отдельно добавляем типографский минус «−»,
 * чтобы знак всегда стоял перед суммой независимо от локали.
 */
export function formatRub(value: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value < 0 ? '−' : '';
  return `${sign}${formatted} ₽`;
}

/** Универсальное число с русским разделителем тысяч: 1500 → "1 500". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Индекс участия: 0.6 → "0,6". Одна цифра после запятой;
 * точка заменяется на запятую по русскому стандарту.
 * Рядом с элементом в UI стоит класс tabular-nums — ширина цифр фиксирована,
 * поэтому анимированный счётчик не «дёргает» вёрстку.
 */
export function formatIndex(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Значение + единица измерения: (12, "недель") → "12 недель"; для ₽ делегируем formatRub. */
export function formatWithUnit(value: number, unit: string): string {
  if (unit === '₽') return formatRub(value);
  return `${formatNumber(value)} ${unit}`;
}

/** Сокращения дней недели (en → ru), т.к. Intl weekday:'short' возвращает английские имена. */
const WEEKDAY_SHORT: Record<string, string> = {
  Mon: 'пн', Tue: 'вт', Wed: 'ср', Thu: 'чт', Fri: 'пт', Sat: 'сб', Sun: 'вс',
};

/**
 * Относительная дата для списка транзакций: "Сегодня 14:30", "Вчера 09:00", "2 дн. назад".
 * ВАЖНО: «сегодня» берётся не из системных часов, а из константы REFERENCE_TODAY
 * (дата последнего мок-события 2025-01-15) — так демо выглядит одинаково
 * при любом реальном времени запуска и тесты детерминированы.
 * Логика: считаем разницу в целых сутках; >7 дней показываем дату + день недели.
 */
export function relativeDate(dateStr: string): string {
  const REFERENCE_TODAY = new Date('2025-01-15T14:30:00');
  // Пробел вместо «T» в мок-датах приводим к ISO, чтобы Date корректно распарсил строку
  const d = new Date(dateStr.replace(' ', 'T'));
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((REFERENCE_TODAY.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return `Сегодня ${time}`;
  if (diffDays === 1) return `Вчера ${time}`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${d.toLocaleDateString('ru-RU')} · ${WEEKDAY_SHORT[wd] ?? ''}`.trim();
}

/** Полная дата «день.месяц.год» для страницы истории: "15.01.2025". */
export function fullDate(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
