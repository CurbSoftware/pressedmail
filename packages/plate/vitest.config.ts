import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @kit/plate.
 *
 * Several upstream Plate plugins (`@platejs/math`, `@platejs/code-block`)
 * import CSS files (katex, prism themes) at runtime. Vitest's default
 * jsdom environment can't process those imports without a PostCSS pipeline,
 * so we disable CSS handling and inline the @platejs deps so they resolve
 * through Node's CJS interop rather than vite's ESM-only resolver.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: [/@platejs\//, 'platejs'],
      },
    },
    css: false,
  },
});
