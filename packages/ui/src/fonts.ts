import localFont from 'next/font/local';

const sans = localFont({
  src: [
    {
      path: './assets/fonts/inter/inter-v20-latin-100.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-200.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-300.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-700.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-800.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: './assets/fonts/inter/inter-v20-latin-900.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-sans-fallback',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
});

const heading = localFont({
  src: [
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-200.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-300.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-500.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-700.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './assets/fonts/plus-jakarta-sans/plus-jakarta-sans-v12-latin-800.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-heading',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
});

export { heading, sans };
