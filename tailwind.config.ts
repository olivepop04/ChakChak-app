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
      // 디자인 가이드 Day5 확정값. DEFAULT=진한값(배경) · soft=연한값(배경/보조) ·
      // ink=그진한 배경 위에 얹는 글자색(대부분 soft와 같음, warning만 예외).
      // 완료/성공은 포인트 그린을 그대로 겸용하기로 했어서 별도 색을 안 둠 — brand 그대로 쓸 것.
      colors: {
        brand: { DEFAULT: '#00A56E', soft: '#E9F9EF', ink: '#E9F9EF' },
        danger: { DEFAULT: '#EA764B', soft: '#FFF0ED', ink: '#FFF0ED' },
        warning: { DEFAULT: '#FEC60A', soft: '#FFF9E6', ink: '#7F6925' },
        info: { DEFAULT: '#2B65D0', soft: '#EBEFFA', ink: '#EBEFFA' },
        // Day9 인풋 테두리/포커스 색. 2026-09-23 정식 토큰화 — 기존 neutral 팔레트
        // 어디에도 정확히 안 맞아서(둘 다 인접 단계 사이) 값 그대로 이름만 붙임.
        hairline: { DEFAULT: '#E0E0E0', focus: '#333333' },
        // 2026-09-24 정식 토큰화. 목업(착착 화면 목업)에서 쓰던 "아주 옅은 회색"인데
        // 클래스명(text-faint)만 코드에 쓰이고 토큰 정의가 없어서 검정으로 그려지고 있었다.
        faint: '#CCCCCC',
      },
      // Day8 타입 스케일 6단계 중 Tailwind 기본값에 없는 것만. 24·20px은
      // 기존 text-2xl·text-xl과 이미 같아서 안 넣음(중복 방지).
      fontSize: {
        subtitle: '17px',
        body: '15px',
        label: '13px',
        caption: '11px',
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
