/**
 * preload.js — мост между главным процессом и интерфейсом (renderer).
 *
 * Renderer-код (React) не имеет прямого доступа к системным функциям.
 * Здесь мы безопасно прокидываем только то, что нужно: управление окном
 * и секретный токен для запросов к API.
 * После этого в React доступен объект window.electronAPI.
 */

const { contextBridge, ipcRenderer } = require('electron')

// Главный процесс передал токен через аргумент --palaces-token=...
// Находим его среди аргументов процесса.
const tokenArg = process.argv.find((a) => a.startsWith('--palaces-token='))
const apiToken = tokenArg ? tokenArg.split('=')[1] : ''

contextBridge.exposeInMainWorld('electronAPI', {
  // Свернуть окно.
  minimize: () => ipcRenderer.send('window:minimize'),
  // Закрыть окно (и всё приложение).
  close: () => ipcRenderer.send('window:close'),
  // Секретный токен — renderer прикладывает его к каждому запросу к API.
  getToken: () => apiToken,
})
