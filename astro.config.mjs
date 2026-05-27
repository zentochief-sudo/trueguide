// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { rehypeAdInject } from './src/lib/rehype-ad-inject.mjs';
import { rehypeInternalLinks } from './src/lib/rehype-internal-links.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://goinatlas.com',
  output: 'static',
  integrations: [sitemap()],
  build: {
    // Inline all CSS as <style> tags — eliminates render-blocking <link> requests
    // Saves ~1160ms FCP/LCP on article pages (BaseLayout + related-articles CSS)
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    // Inject inline ad slots into article prose at build time.
    // Inserts an ad before every 2nd <h2> — no runtime JS, pure HTML.
    rehypePlugins: [
      rehypeInternalLinks,
      [rehypeAdInject, { every: 1 }],
    ],
  },
});
