import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        // Mobile-first. The app is a mobile web app; cap the shell width.
        app: '480px',
      },
      height: {
        13: '3.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
