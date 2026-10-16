/**
 * JsonLd.tsx — React-обёртка для вставки JSON-LD блоков в <head>.
 *
 * Логика:
 * - Принимает готовый schema-объект (из utils/structuredData), сериализует его
 *   через jsonLdScript() с экранированием "<" (защита от XSS через "</script>").
 * - Монтирует <script type="application/ld+json"> в document.head вручную,
 *   потому что Vite-SPA не имеет head-компонента уровня Next.js, а дублировать
 *   скрипты при SPA-навигации нельзя.
 * - При unmount удаляет свой узел → на каждой странице только её разметка,
 *   поисковый робот видит консистентный граф данных.
 */
import { useEffect } from 'react';
import { jsonLdScript } from '../utils/structuredData';

interface JsonLdProps {
  /** Один или несколько Schema.org-объектов (Organization + WebSite и т.д.). */
  schemas: unknown[];
}

export function JsonLd({ schemas }: JsonLdProps) {
  useEffect(() => {
    // Стабилизируем ссылку на массив: пересоздаём узлы только при реальном
    // изменении содержимого (JSON-строки сравниваются как ключи).
    const scripts = schemas.map((schema) => {
      const el = document.createElement('script');
      el.type = 'application/ld+json';
      el.text = jsonLdScript(schema);
      document.head.appendChild(el);
      return el;
    });
    return () => scripts.forEach((el) => el.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemas.map(jsonLdScript).join('|')]);

  return null; // компонент рендерит ничего в тело — только head-эффект
}
