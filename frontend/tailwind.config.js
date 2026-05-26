/**
 * Конфиг Tailwind CSS — описывает, где искать классы и какая палитра.
 *
 * Палитра — в духе Claude Code: тёплый чёрный фон, оранжевый акцент
 * Anthropic, низкоконтрастные границы. Имена `bg/surface/accent` нейтральны,
 * чтобы тему можно было поменять одним местом.
 */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:           '#1a1a18',   // основной тёплый-чёрный фон
        surface:      '#262624',   // фон карточек, sidebar, инпутов
        'surface-2':  '#2e2c2a',   // hover / выбранная карточка
        border:       '#3a3833',   // обычные разделители
        'border-strong': '#4a4844',
        accent:       '#d97757',   // оранжевый Anthropic (Crail)
        'accent-hover': '#e0855a',
        'accent-dim': '#b25e3f',
        text:         '#ebe9e5',   // основной текст
        'text-muted': '#a8a6a1',   // приглушённый
        'text-dim':   '#6e6c68',   // ещё тише (placeholder, hint)
        danger:       '#c44545',
        success:      '#7ba05b',
      },
      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: [
          'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas',
          'Liberation Mono', 'monospace',
        ],
        serif: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
