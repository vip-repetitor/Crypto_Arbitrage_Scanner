/**
 * leaderboard.ts — математическая модель доходностей «всех пользователей».
 *
 * Логика генерации (имитация бэкенда):
 * 1. Используется ДЕТЕРМИНИРОВАННЫЙ псевдослучайный генератор (mulberry32)
 *    с фиксированным seed — одинаковый лидерборд на каждой перезагрузке,
 *    что важно и для демо, и для юнит-тестов (нет флаков).
 * 2. Каждый пользователь получает профиль поведения: сумма депозита и число
 *    достигнутых целей коррелируют («лояльные» держат больше), чтобы рейтинг
 *    выглядел экономически осмысленно, а не случайным шумом.
 * 3. Индекс участия считается по той же модели, что и Python-модель проекта:
 *       index = base(0.1) + Б(стрейк) + Б(объём) + Б(активность)
 *    где каждый Б — вклад достигнутого порога соответствующей цели.
 * 4. Годовая доходность (%) считается ПО ФОРМУЛЕ PYTHON-МОДЕЛИ (model.py,
 *    user_yield_pct) — аудит 2026-10 исправил расхождение калибровок:
 *       yield = GUARANTEED_YIELD_PCT + index * YIELD_PP_PER_INDEX
 *    где YIELD_PP_PER_INDEX = INDEX_TO_RUB / 10 = 7.5 п.п. на 1.0 индекса
 *    (паритет с model.py: bonus_pp = index * rub_per_index_point / 10). Паритет с моделью гарантирует: одна и та же строка рейтинга
 *    и карточка пользователя показывают одинаковые проценты.
 *    Примечание: полный индекс 1.3 даёт 13.75% — выше маркетингового обещания
 *    «до ~10%»; это зафиксировано в parity-тесте как известная особенность
 *    дефолтных весов (маржа при этом падает ниже целевых 3%, см. стресс-тесты).
 * 5. Сумма дохода (₽/год) = deposit * yield / 100.
 */
import { GUARANTEED_YIELD_PCT, YIELD_PP_PER_INDEX as PP } from '../types';

/** Одна строка лидерборда — агрегированный профиль пользователя. */
export interface LeaderRow {
  rank: number;          // место в рейтинге после сортировки (присваивается buildLeaderboard)
  name: string;          // отображаемое имя (маскировано как в реальном продукте)
  avatar: string;        // эмодзи-аватар (не завязан на цвет — a11y)
  deposit: number;       // средний удерживаемый депозит, ₽
  weeksHeld: number;     // недель непрерывного удержания (стрейк)
  depositsPerMonth: number; // пополнений в месяц (активность)
  goalsAchieved: number; // сколько из трёх целей разблокировано (0..3)
  index: number;         // итоговый индекс участия (0.1 .. 1.3)
  yieldPct: number;      // фактическая годовая доходность, %
  yearlyRub: number;     // ожидаемый доход за год, ₽
  isMe?: boolean;        // подсветка текущего пользователя в UI
}

/** Базовый купон ОФЗ — гарантия продукта («гарантированно 4%»), паритет с model.py. */
export const BASE_YIELD_PCT = GUARANTEED_YIELD_PCT;
/**
 * Сколько п.п. годовых даёт 1.0 индекса участия. Формула паритета с Python:
 * model.py считает bonus_pp = index * rub_per_index_point / 10 (курс 75 ₽/год
 * на базе 1000₽ => 7.5 п.п. за 1.0 индекса; индекс 0.6 -> 8.5%). Держим ту же арифметику, чтобы
 * лидерборд и карточка показывали одинаковые проценты для одного индекса.
 */
export const YIELD_PP_PER_INDEX = PP; // единый источник — types.ts (паритет с model.py)

/** Доходность (%) по формуле модели выплат: гарантия + премия за индекс. */
export function yieldForIndex(index: number): number {
  return +(BASE_YIELD_PCT + index * YIELD_PP_PER_INDEX).toFixed(2);
}

/** Вклады порогов целей в индекс (совпадают с model/config.yaml и ТЗ). */
const INDEX_BASE = 0.1;
// Кортеж-типы [number, number] — tieredBonus строго ожидает ровно два порога/бонуса
const LOYALTY_BONUS: [number, number] = [0.3, 0.5];   // 8 нед → +0.3, 20 нед → +0.5
const VOLUME_BONUS: [number, number] = [0.2, 0.4];    // 2000₽ → +0.2, 5000₽ → +0.4
const ACTIVITY_BONUS: [number, number] = [0.2, 0.3];  // 3/мес → +0.2, 6/мес → +0.3

/**
 * mulberry32 — компактный детерминированный PRNG.
 * Возвращает функцию [0,1); последовательность полностью определяется seed,
 * поэтому мок-данные стабильны между запусками и окружениями (node/browser).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Имена-заглушки участников (реальный продукт показал бы никнеймы/маску почты). */
const NAMES = [
  'Иван П.', 'Мария К.', 'Алексей С.', 'Ольга Д.', 'Дмитрий Ж.',
  'Анна Р.', 'Сергей Т.', 'Екатерина М.', 'Николай Б.', 'Виктория Л.',
  'Павел Н.', 'Татьяна Ф.', 'Роман Г.', 'Юлия В.', 'Максим Е.',
  'Светлана Ш.', 'Артём Ц.', 'Наталья О.', 'Кирилл А.', 'Елена Х.',
];

/** Эмодзи-аватары — визуальная якорная метка без опоры на цвет (a11y-требование ТЗ). */
const AVATARS = ['🦊', '🐼', '🦉', '🐝', '🦁', '🐧', '🦄', '🐢', '🦔', '🐬'];

/**
 * Инкремент бонуса цели по двум порогам: возвращает вклад в индекс
 * (0, bonus1 или bonus1+bonus2) в зависимости от текущих значений.
 * Пороги «второго уровня» дают дельту, а не замену первого — как в модели выплат.
 */
function tieredBonus(current: number, thresholds: [number, number], bonuses: [number, number]): number {
  if (current >= thresholds[1]) return bonuses[1];       // высший порог включает полный бонус ступени
  if (current >= thresholds[0]) return bonuses[0];
  return 0;
}

/**
 * Генерирует n строк лидерборда. Детерминировано при одном seed.
 * Алгоритм: рандом выбирает «класс» пользователя (новичок / активный / лояльный),
 * затем значения целей коррелируют внутри класса, после чего считаются индекс,
 * доходность и рублёвый доход. Финальная сортировка — по yearlyRub (₽/год),
 * потому что именно деньги интересны пользователю в рейтинге.
 */
export function generateLeaderboard(count = 20, seed = 20250115, meIndex?: number, meDeposit?: number): LeaderRow[] {
  const rnd = mulberry32(seed);
  const rows: LeaderRow[] = [];

  for (let i = 0; i < count; i++) {
    // Класс пользователя: чем выше roll, тем «старше» и лояльнее клиент
    const profile = rnd();                       // 0..1
    const weeksHeld = Math.round(2 + profile * 26);            // 2..28 недель
    const deposit = Math.round((300 + profile * 6200) * (0.6 + rnd() * 0.8)); // ₽, коррелирует с профилем
    const depositsPerMonth = Math.max(0, Math.round(profile * 7 + rnd() * 2)); // 0..8 пополн/мес

    // Вклады трёх целей в индекс по порогам модели выплат
    const loyalty = tieredBonus(weeksHeld, [8, 20], LOYALTY_BONUS);
    const volume = tieredBonus(deposit, [2000, 5000], VOLUME_BONUS);
    const activity = tieredBonus(depositsPerMonth, [3, 6], ACTIVITY_BONUS);

    const index = +(INDEX_BASE + loyalty + volume + activity).toFixed(2);
    const goalsAchieved = Number(loyalty > 0) + Number(volume > 0) + Number(activity > 0);
    // Доходность: базовые 4% ОФЗ + премия по формуле модели выплат (yieldForIndex)
    const yieldPct = yieldForIndex(index);
    const yearlyRub = Math.round((deposit * yieldPct) / 100);

    rows.push({
      rank: 0,
      name: NAMES[i % NAMES.length],
      avatar: AVATARS[i % AVATARS.length],
      deposit, weeksHeld, depositsPerMonth, goalsAchieved,
      index, yieldPct, yearlyRub,
    });
  }

  // Текущий пользователь («Я») добавляется отдельной строкой, если переданы его данные
  if (meIndex !== undefined && meDeposit !== undefined) {
    // Строка «Вы» считается той же функцией, что и остальные — паритет гарантирован
    const yieldPct = yieldForIndex(meIndex);
    rows.push({
      rank: 0, name: 'Вы', avatar: '⭐',
      deposit: meDeposit, weeksHeld: 12, depositsPerMonth: 4, goalsAchieved: 2,
      index: meIndex, yieldPct, yearlyRub: Math.round((meDeposit * yieldPct) / 100),
      isMe: true,
    });
  }

  // Сортировка: деньги → индекс → депозит (стабильный порядок при ничьих)
  rows.sort((a, b) => b.yearlyRub - a.yearlyRub || b.index - a.index || b.deposit - a.deposit);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Агрегаты для блока статистики над таблицей (средние по выборке). */
export interface LeaderStats {
  users: number;
  avgYieldPct: number;
  totalYearlyRub: number;
  topYieldPct: number;
  avgIndex: number;
}

/**
 * Считает сводную статистику доходностей всех пользователей:
 * средневзвешенная доходность, суммарные выплаты, лучший результат.
 * Простое среднее арифметическое — корректно для равных «долей» пользователей
 * в MVP; на проде заменим на взвешенное по AUM.
 */
export function aggregateStats(rows: LeaderRow[]): LeaderStats {
  if (rows.length === 0) {
    return { users: 0, avgYieldPct: 0, totalYearlyRub: 0, topYieldPct: 0, avgIndex: 0 };
  }
  const sum = rows.reduce(
    (acc, r) => ({
      y: acc.y + r.yieldPct,
      rub: acc.rub + r.yearlyRub,
      idx: acc.idx + r.index,
    }),
    { y: 0, rub: 0, idx: 0 },
  );
  return {
    users: rows.length,
    avgYieldPct: +(sum.y / rows.length).toFixed(2),
    totalYearlyRub: Math.round(sum.rub),
    topYieldPct: Math.max(...rows.map((r) => r.yieldPct)),
    avgIndex: +(sum.idx / rows.length).toFixed(2),
  };
}
