/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // LoLテーマカラー
        'lol-gold': '#c89b3c',
        'lol-gold-light': '#d4a94a',
        'lol-dark': '#0a0e1a',
        'lol-dark-2': '#0f1923',
        'lol-border': '#1e2a3a'
      },
      fontFamily: {
        sans: ['Segoe UI', 'Hiragino Sans', 'Noto Sans JP', 'sans-serif']
      }
    }
  },
  plugins: []
}
