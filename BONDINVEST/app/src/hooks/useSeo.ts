/**
 * useSeo.ts — хук применения SEO-метаданных страницы.
 *
 * Логика: компонент роута вызывает usePageMeta(meta) внутри useEffect —
 * при смене маршрута (или пересчёте живых данных, например прогресса цели)
 * title/description/canonical обновляются точечно. Дескопируем «head-менеджмент»
 * без тяжёлых библиотек (react-helmet не нужен: тегов мало, обновлений немного).
 */
import { useEffect } from 'react';
import { setSeoMeta, type PageMeta } from '../utils/seo';

/** Применяет метаданные страницы при монтировании и при каждом изменении meta. */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    setSeoMeta(meta);
    // meta — обычный объект-шаблон; зависимости по полям, чтобы реагировать
    // на живые данные (например, goalMeta пересчитывается при росте current).
  }, [meta.title, meta.description, meta.path]);
}
