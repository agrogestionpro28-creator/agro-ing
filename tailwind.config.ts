import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base con tinte azul-verde (para cards/surfaces sobre el degradé)
        base: {
          DEFAULT: 'rgba(10,22,40,0.0)',
          2: 'rgba(13,26,36,0.55)',
          3: 'rgba(16,32,46,0.70)',
          4: 'rgba(20,38,56,0.80)',
          5: 'rgba(30,50,72,0.90)',
          6: 'rgba(40,64,88,0.95)',
        },
        // Verde esmeralda — acento principal
        ochre: {
          DEFAULT: '#22d3a0',
          dark: '#16a87e',
          light: '#5eead4',
          muted: '#0d5c45',
          tint: 'rgba(34,211,160,0.10)',
        },
        // Verde AFA (más intenso, compite con esmeralda — unificamos)
        afa: {
          DEFAULT: '#22d3a0',
          dark: '#16a87e',
          light: '#5eead4',
          tint: 'rgba(34,211,160,0.12)',
        },
        // Azul cielo — acento secundario
        sky: {
          DEFAULT: '#38bdf8',
          dark: '#0284c7',
          light: '#7dd3fc',
          tint: 'rgba(56,189,248,0.10)',
        },
        // Texto
        hi: '#f0f6ff',
        mid: '#7a90a8',
        lo: '#4a5c70',
        faint: '#1a2740',
        subtle: '#5a7288',
        // Estados
        danger: '#f87171',
        warn: '#fbbf24',
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
