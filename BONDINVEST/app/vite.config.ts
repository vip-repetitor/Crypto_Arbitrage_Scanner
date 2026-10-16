import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Плагин автогенерации SEO-артефактов: canonical/OG в index.html на этапе
// transform + sitemap.xml/robots.txt в dist на этапе writeBundle.
// Единый источник правды — реестр PAGES в scripts/generate-seo.mjs.
import seoGenerator from './scripts/generate-seo.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), seoGenerator()],
  server: { port: 5173 },
});
