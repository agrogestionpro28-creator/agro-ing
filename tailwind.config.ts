import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base oscura
        base: {
          DEFAULT: '#0a0a0a',
          2: '#111111',
          3: '#131313',
          4: '#1a1a1a',
          5: '#262626',
          6: '#333333',
        },
        // Ocre/dorado
        ochre: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          light: '#fcd34d',
          muted: '#92400e',
          tint: 'rgba(245,158,11,0.10)',
        },
        // Verde AFA
        afa: {
          DEFAULT: '#2EAA6E',
          dark: '#1d7a4d',
          light: '#4dc88a',
          tint: 'rgba(46,170,110,0.12)',
        },
        // Texto
        hi: '#f5f5f5',
        mid: '#a3a3a3',
        lo: '#525252',
        faint: '#2a2a2a',
        // Estados
        danger: '#ef4444',
        warn: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        full: '9999px',
      },
      aspectRatio: {
        square: '1 / 1',
      },
    },
  },
  plugins: [],
};
export default config;
