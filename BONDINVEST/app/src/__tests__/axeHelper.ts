import { expect } from 'vitest';

/** Прогоняет axe-core по контейнеру и не допускает нарушений */
export async function runAxe(el: HTMLElement): Promise<void> {
  const axe = await import('axe-core');
  const results = await axe.default.run(el, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  });
  const violations = results.violations
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.html).join('; ')})`)
    .join('\n');
  expect(violations).toBe('');
}
