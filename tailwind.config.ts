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
        paperlogy: ['var(--font-paperlogy)', 'Paperlogy', 'sans-serif'],
      },
      maxWidth: {
        // Mobile-first. The app is a mobile web app; cap the shell width.
        app: '480px',
      },
      height: {
        13: '3.25rem',
      },
      // h-13 만 넣어 두면 min-h-13 은 조용히 버려집니다.
      // Tailwind 의 minHeight 기본값은 spacing 스케일을 쓰는데 거기에 13 이 없어서,
      // min-h-13 을 쓴 버튼이 최소 높이를 아예 못 받습니다 (2026-09-11에 실제로 겪음).
      // 고정 높이(h-13) 를 최소 높이(min-h-13) 로 바꿀 때 둘 다 있어야 짝이 맞습니다.
      minHeight: {
        13: '3.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
