/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // LoL ダークゲーミングテーマ
        lol: {
          bg:       '#0a0e1a',
          card:     '#111827',
          card2:    '#0D1626',
          border:   '#785a28',
          'border-hover': '#1E3A5F',
          accent:   '#c89b3c',
          text:     '#f0e6d3',
          'text-body': '#C8D8F0',
          'text-sub':  '#6B7A99',
          cyan:     '#00C6FF',
          success:  '#00E676',
          warning:  '#FFB347',
          error:    '#FF6B6B',
        },
        // ランクカラー
        rank: {
          iron:        '#8D9395',
          bronze:      '#CD7F32',
          silver:      '#C0C0C0',
          gold:        '#C89B3C',
          platinum:    '#00B4B0',
          emerald:     '#00A36C',
          diamond:     '#4FC3F7',
          master:      '#9C27B0',
          grandmaster: '#E53935',
          challenger:  '#00E5FF',
        },
      },
      fontFamily: {
        sans:    ['"Noto Sans JP"', 'sans-serif'],
        display: ['Rajdhani', '"Noto Sans JP"', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-lol': 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
        'gradient-gold': 'linear-gradient(90deg, #c89b3c 0%, #f0e6d3 50%, #c89b3c 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
