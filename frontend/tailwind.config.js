/**
 * Конфиг Tailwind CSS — описывает, где искать классы и какая палитра.
 * Формат CommonJS (module.exports), потому что package.json проекта —
 * тоже CommonJS (это нужно для главного процесса Electron).
 */
module.exports = {
  // Файлы, в которых Tailwind ищет используемые классы.
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // Своя палитра проекта — тёмная тема с фиолетовым акцентом.
      colors: {
        bg: '#0f0f1a',        // основной фон
        surface: '#1a1a2e',   // фон карточек и панелей
        accent: '#7c3aed',    // фиолетовый акцент
        'accent-dim': '#5b21b6',
      },
    },
  },
  plugins: [],
}
