/**
 * index.js — главный процесс Electron.
 *
 * Главный процесс отвечает за:
 *   1. Запуск Python-бэкенда (FastAPI сервер).
 *   2. Создание окна приложения.
 *   3. Остановку Python при закрытии окна.
 *
 * Формат CommonJS (require) — так стабильнее всего для главного процесса.
 */

const { app, BrowserWindow, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const crypto = require('crypto')

// Папка с Python-бэкендом (прописана абсолютно).
const BACKEND_DIR = 'D:\\mind\\palaces-of-the-mind\\backend'

// Секретный токен на этот запуск приложения. Генерируется случайно при
// каждом старте. Его получит и Python-сервер, и окно приложения —
// и сервер будет принимать запросы только с этим токеном.
const API_TOKEN = crypto.randomBytes(24).toString('hex')

// Режим разработки: когда приложение не упаковано в .exe.
const isDev = !app.isPackaged

let mainWindow = null   // ссылка на окно
let pyProcess = null    // ссылка на процесс Python


/** Запускает Python-сервер (python -m api.main) из папки backend. */
function startBackend() {
  pyProcess = spawn('python', ['-m', 'api.main'], {
    cwd: BACKEND_DIR,
    // Передаём токен серверу через переменную окружения.
    env: { ...process.env, PALACES_TOKEN: API_TOKEN },
  })

  // Перенаправляем вывод Python в консоль Electron — удобно для отладки.
  pyProcess.stdout.on('data', (d) => console.log('[python]', d.toString()))
  pyProcess.stderr.on('data', (d) => console.log('[python]', d.toString()))
  pyProcess.on('error', (e) => console.error('Не удалось запустить Python:', e))
}


/** Создаёт главное окно приложения. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,                 // окно без системной рамки
    backgroundColor: '#0f0f1a',
    webPreferences: {
      // preload-скрипт безопасно прокидывает в renderer функции окна.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Передаём токен в окно через аргумент — preload его прочитает.
      additionalArguments: ['--palaces-token=' + API_TOKEN],
    },
  })

  if (isDev) {
    // В разработке грузим страницу с dev-сервера Vite.
    // loadURL может не успеть (Vite ещё стартует) — тогда повторяем.
    const tryLoad = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(tryLoad, 500)
      })
    }
    tryLoad()
  } else {
    // В собранном виде грузим готовый файл из папки dist.
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}


// ─── Обработчики кнопок окна (вызываются из renderer через preload) ─────────

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window:close', () => mainWindow && mainWindow.close())


// ─── Жизненный цикл приложения ──────────────────────────────────────────────

app.whenReady().then(() => {
  startBackend()
  // Ждём 2 секунды, чтобы Python-сервер успел подняться, затем окно.
  setTimeout(createWindow, 2000)
})

// При закрытии всех окон — гасим Python и выходим.
app.on('window-all-closed', () => {
  if (pyProcess) pyProcess.kill()
  app.quit()
})

// Подстраховка: убить Python при выходе из приложения.
app.on('before-quit', () => {
  if (pyProcess) pyProcess.kill()
})
