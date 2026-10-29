import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base clara — área de contenido principal
        base: {
          DEFAULT: '#f0f4f8',
          2: '#ffffff',
          3: '#f8fafc',
          4: '#e8eef5',
          5: '#d0dae6',
          6: '#b8c8d8',
        },
        // Verde esmeralda — acento principal
        ochre: {
          DEFAULT: '#0ea87a',
          dark: '#0b7d5c',
          light: '#22d3a0',
          muted: '#d1fae5',
          tint: 'rgba(14,168,122,0.10)',
        },
        // Verde AFA
        afa: {
          DEFAULT: '#0ea87a',
          dark: '#0b7d5c',
          light: '#22d3a0',
          tint: 'rgba(14,168,122,0.10)',
        },
        // Azul celeste
        sky: {
          DEFAULT: '#0284c7',
          dark: '#0369a1',
          light: '#38bdf8',
          tint: 'rgba(2,132,199,0.10)',
        },
        // Texto — sobre fondo claro
        hi: '#0f172a',
        mid: '#475569',
        lo: '#94a3b8',
        faint: '#e2e8f0',
        subtle: '#64748b',
        // Estados
        danger: '#dc2626',
        warn: '#d97706',
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
