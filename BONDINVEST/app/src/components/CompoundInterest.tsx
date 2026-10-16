/**
 * CompoundInterest.tsx — интерактивные «мысли о сложном проценте».
 *
 * Логика компонентов:
 *  - CompoundInsight: компактная врезка-подсказка (главная мысль про капитализацию),
 *    встраивается рядом с прогрессом на дашборде и в блок «Математика выгоды».
 *  - CompoundCalculator: мини-калькулятор траектории дохода. Показывает формулу
 *    «Доход за год = Сумма × Бонус; следующий год считается от (Сумма + Доход)»
 *    и построчную таблицу капитализации для базы 100 000 ₽ и текущего индекса.
 *    Данные считаются утилитой projectCompound (единый источник правды, тот же что и в тестах).
 *  - FaqCompound: готовые смысловые блоки (снятие возражения «это копейки»,
 *    ответ FAQ «зачем держать 20 недель», тезис для карточки уровней).
 */
import { motion } from 'framer-motion';
import { formatRub } from '../utils/format';
import { annualBonusRub, projectCompound } from '../utils/compound';

/** Тезисы проекта — единое место, чтобы тексты не разъезжались между экранами. */
export const COMPOUND_THOUGHTS = {
  /** Главная мысль для первого экрана (рядом с прогрессом) */
  hero: 'Бонус к индексу — это не разовая надбавка: при реинвестировании он начинает работать по принципу сложного процента.',
  /** Строка капитализации сразу после расчёта годовой суммы */
  afterAnnual: 'Капитализация: доход каждого года остаётся в базе — следующий год начисляется уже с него.',
  /** Мысль для карточки уровней */
  levels: '+0.3 и +0.5 — это база для сложного процента: каждый новый бонус увеличивает следующую доходность.',
  /** FAQ: зачем держать 20 недель */
  faq20weeks:
    'Потому что длинный горизонт даёт не только больший бонус, но и время для эффекта сложного процента.',
  /** Снятие возражения «это копейки» */
  objection:
    'Да, 37,5 ₽ в год на 100 000 ₽ — небольшая сумма. Но смысл не в разовой выплате, а в том, что этот бонус можно реинвестировать и запустить сложный процент. Маленький, но стабильный прирост, если его не выводить, со временем даёт ощутимый эффект — «тихая» надбавка, которая работает, пока вы соблюдаете простое правило удержания.',
  /** Пуш/email-формат: «почти на максимуме» */
  push:
    'У вас уже 12 недель подряд — осталось всего 8 до максимального бонуса +0,5. Как только он закрепится, вы сможете реинвестировать доход и запустить эффект сложного процента. Не срывайтесь на финишной прямой — дайте механизму время на работу.',
  /** Лендинг: бонус как топливо */
  landing:
    'Бонус за удержание — не просто разовая выплата. Это топливо для сложного процента: каждый новый бонус увеличивает базу для следующего начисления. Так маленькая, но стабильная надбавка превращается в устойчивый рост.',
  /** Опытные инвесторы: горизонт и эффект */
  pro:
    'На коротких горизонтах эффект почти незаметен, но на длинных — капитализация усиливает итоговую доходность без дополнительных рисков. Именно поэтому цель на 20 недель — это не «ещё 8 недель», а больше времени механизму на работу.',
} as const;

/** Врезка с главной мыслью — стеклянная плашка в стиле премиальных банковских приложений. */
export function CompoundInsight({ text }: { text?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl border border-gold/25 bg-gold-soft/60 px-4 py-3"
    >
      <p className="text-sm leading-relaxed text-ink">
        <span aria-hidden className="mr-1">📈</span>
        {text ?? COMPOUND_THOUGHTS.hero}
      </p>
    </motion.div>
  );
}

/**
 * Мини-калькулятор сложного процента.
 * @param index текущий индекс участия — из него считается годовая ставка бонуса.
 */
export function CompoundCalculator({ index }: { index: number }) {
  // Единая математика: 100 000 ₽ демо-база, горизонт 5 лет, ставка из текущего индекса.
  const p = projectCompound(100_000, index, 5);
  const yearIncome = annualBonusRub(index);

  return (
    <section
      aria-label="Калькулятор сложного процента"
      className="rounded-3xl bg-white p-6 shadow-premium ring-1 ring-slate-100"
    >
      <h2 className="text-lg font-semibold text-ink">
        🧮 Сложный процент: как бонус работает на вашем примере
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.landing}</p>

      {/* Формула простыми словами — как просил заказчик, прямо в интерфейсе */}
      <div className="mt-4 rounded-2xl bg-surface px-4 py-3 text-sm tabular-nums text-ink">
        <p>Доход за год: Сумма × (Бонус к индексу)</p>
        <p className="mt-1">Доход второго года: (Сумма + Доход за год 1) × (Бонус к индексу)</p>
        <p className="mt-1 text-muted">Так работает сложный процент: каждый доход увеличивает базу следующего начисления.</p>
      </div>

      {/* Построчная траектория капитализации: база → доход → итог */}
      <table className="mt-4 w-full text-sm tabular-nums">
        <caption className="sr-only">Траектория дохода по годам при реинвестировании</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 font-medium">Год</th>
            <th scope="col" className="py-1 font-medium">База на начало</th>
            <th scope="col" className="py-1 font-medium">Доход</th>
            <th scope="col" className="py-1 font-medium">Итог</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r) => (
            <tr key={r.year} className="border-t border-slate-100">
              <td className="py-1.5">{r.year}</td>
              <td className="py-1.5">{Math.round(r.baseStart).toLocaleString('ru-RU')} ₽</td>
              <td className="py-1.5 text-success">{r.income.toFixed(2)} ₽</td>
              <td className="py-1.5 font-medium">{r.totalEnd.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Итоговая строка: сравнение простого и сложного процента — «копейки превращаются в выгоду» */}
      <p className="mt-3 text-sm text-ink">
        Год 1 приносит <b>{formatRub(yearIncome)}</b>. За 5 лет простой процент дал бы{' '}
        <b>{p.simpleTotal.toFixed(2)} ₽</b>, а с реинвестированием —{' '}
        <b className="text-gold">{p.compoundTotal.toFixed(2)} ₽</b>
        {' '}(+{p.extra.toFixed(2)} ₽ выгоды капитализации). Даже с маленькой ставкой механизм стабильно
        увеличивает доходность.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.objection}</p>
    </section>
  );
}

/** FAQ-блок про сложный процент: два вопроса с готовыми формулировками из контент-плана. */
export function FaqCompound() {
  return (
    <section aria-label="Частые вопросы о сложном проценте" className="rounded-3xl bg-white p-6 shadow-premium ring-1 ring-slate-100">
      <h2 className="text-lg font-semibold text-ink">💡 Вопросы о бонусах и доходе</h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-semibold text-ink">Зачем держать 20 недель?</dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.faq20weeks}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink">Разве 37,5 ₽ в год — не копейки?</dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.objection}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-ink">Что дают +0.3 и +0.5 к индексу?</dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted">{COMPOUND_THOUGHTS.levels}</dd>
        </div>
      </dl>
    </section>
  );
}
