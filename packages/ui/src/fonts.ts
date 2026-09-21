import localFont from 'next/font/local';

// Both families ship as a single variable file each, latin subset, covering
// wght 100-900 for Inter and 200-800 for Plus Jakarta Sans. next/font only
// emits a font-weight descriptor when the loader declares one, so the range is
// stated here rather than left for the browser to infer from the font's wght
// axis. The alternative, a static file per weight, cost sixteen requests and
// about 300 KB to cover the same range.

const sans = localFont({
  src: './assets/fonts/inter/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-sans-fallback',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  display: 'swap',
  preload: true,
});

const heading = localFont({
  src: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-heading',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  display: 'swap',
  preload: true,
});

export { heading, sans };
