import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base azul-negra profunda
        base: {
          DEFAULT: '#080c10',
          2: '#0d1117',
          3: '#111820',
          4: '#1a2332',
          5: '#243040',
          6: '#2e3d52',
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
