import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Конфиг Vite — сборщика фронтенда.
export default defineConfig({
  // Корень renderer-части: index.html и React-код лежат здесь.
  root: 'src/renderer',

  // base: './' — пути к ресурсам относительные. Это обязательно,
  // потому что в собранном виде Electron грузит файл через file://.
  base: './',

  plugins: [react()],

  // Dev-сервер, к которому Electron подключается в режиме разработки.
  server: { port: 5173 },

  build: {
    // Куда складывать собранный фронтенд. Путь относителен root,
    // поэтому ../../dist = frontend/dist.
    outDir: '../../dist',
    emptyOutDir: true,
  },
})
