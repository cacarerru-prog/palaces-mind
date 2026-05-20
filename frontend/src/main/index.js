/**
 * index.js — главный процесс Electron.
 *
 * Отвечает за:
 *   1. Один экземпляр приложения (повторный запуск открывает уже работающее окно).
 *   2. Запуск Python-бэкенда (FastAPI).
 *   3. Создание окна без рамки.
 *   4. Иконку в системном трее с меню.
 *   5. Сворачивание в трей при закрытии окна (приложение остаётся жить).
 *   6. AppUserModelID — чтобы Windows корректно показывал приложение
 *      одним значком на панели задач и позволял закрепить его как pin.
 *   7. Корректную остановку Python при настоящем выходе из приложения.
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const crypto = require('crypto')

// ─── Один экземпляр на весь компьютер ──────────────────────────────────────
//
// requestSingleInstanceLock возвращает false, если приложение уже запущено.
// Тогда новый процесс просто завершается, а у старого срабатывает событие
// second-instance — там мы покажем уже существующее окно.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

// ─── AppUserModelID ─────────────────────────────────────────────────────────
//
// Windows группирует кнопки на панели задач по AppUserModelID. Без явной
// установки Electron-приложения иногда отображаются как «electron.exe»
// и плохо пинятся. Ставим стабильный идентификатор — он совпадает с appId
// в electron-builder.yml.
const APP_USER_MODEL_ID = 'com.palaces.mind'
app.setAppUserModelId(APP_USER_MODEL_ID)

// Папка с Python-бэкендом (прописана абсолютно).
const BACKEND_DIR = 'D:\\mind\\palaces-of-the-mind\\backend'

// Секретный токен на текущий запуск приложения.
const API_TOKEN = crypto.randomBytes(24).toString('hex')

const isDev = !app.isPackaged

let mainWindow = null
let tray = null
let pyProcess = null
// Флаг настоящего выхода — отличает «закрыли окно (сворачиваем в трей)»
// от «нажали Выйти в меню трея (гасим процесс)».
let isQuitting = false


/** Запускает Python-сервер (python -m api.main) из папки backend. */
function startBackend() {
  pyProcess = spawn('python', ['-m', 'api.main'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PALACES_TOKEN: API_TOKEN },
  })
  pyProcess.stdout.on('data', (d) => console.log('[python]', d.toString()))
  pyProcess.stderr.on('data', (d) => console.log('[python]', d.toString()))
  pyProcess.on('error', (e) => console.error('Не удалось запустить Python:', e))
}


/** Создаёт главное окно приложения. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f1a',
    icon: path.join(__dirname, 'assets', 'tray.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: ['--palaces-token=' + API_TOKEN],
    },
  })

  if (isDev) {
    const tryLoad = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(tryLoad, 500)
      })
    }
    tryLoad()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Перехватываем закрытие окна: если это не настоящий выход — просто
  // прячем окно. Приложение остаётся в трее.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}


/** Текущее состояние «запускать при входе». Читаем у ОС, не храним сами. */
function getAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin
}


/** Включает/выключает автозапуск приложения при входе в Windows. */
function setAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    // args не нужны: ярлык просто запустит наш .exe. В dev-режиме
    // обращается к electron.exe — поэтому переключатель показываем
    // только в собранном (packaged) приложении.
  })
  rebuildTrayMenu()
}


/** Перестраивает меню трея — нужно после смены галочки автозапуска. */
function rebuildTrayMenu() {
  if (!tray) return
  const items = [
    { label: 'Открыть', click: () => showWindow() },
    { type: 'separator' },
  ]
  if (app.isPackaged) {
    items.push({
      label: 'Запускать при входе в Windows',
      type: 'checkbox',
      checked: getAutoLaunchEnabled(),
      click: (item) => setAutoLaunch(item.checked),
    })
    items.push({ type: 'separator' })
  }
  items.push({
    label: 'Выйти из приложения',
    click: () => {
      isQuitting = true
      app.quit()
    },
  })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}


/** Создаёт иконку в системном трее с контекстным меню. */
function createTray() {
  // nativeImage из PNG-файла. Если файла нет — fallback на пустую иконку
  // (приложение всё равно запустится, просто без значка трея).
  const iconPath = path.join(__dirname, 'assets', 'tray.png')
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('Palaces of the Mind')
  rebuildTrayMenu()

  // Обычный клик по значку трея — открыть/спрятать окно.
  tray.on('click', () => {
    if (!mainWindow) return createWindow()
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      showWindow()
    }
  })
}


/** Показывает (создаёт, если ещё нет) и поднимает окно на передний план. */
function showWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}


// ─── Обработчики кнопок окна (вызываются из renderer через preload) ─────────

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window:toggleMaximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
// «Закрыть» из интерфейса = свернуть в трей. Настоящий выход — только
// через пункт меню трея.
ipcMain.on('window:close', () => mainWindow && mainWindow.hide())


// ─── Жизненный цикл приложения ──────────────────────────────────────────────

// Если пользователь запустил приложение второй раз (например, кликнул
// pinned-ярлык в панели задач) — показываем уже работающее окно вместо
// запуска дубля.
app.on('second-instance', () => {
  showWindow()
})

app.whenReady().then(() => {
  startBackend()
  createTray()
  // Ждём, пока Python поднимется, потом окно (страница сделает запросы к API).
  setTimeout(createWindow, 2000)
})

// На Windows закрытие всех окон НЕ значит выход — приложение продолжает
// работать в трее. Поэтому обработчика window-all-closed нет.

app.on('before-quit', () => {
  isQuitting = true
  if (pyProcess) {
    try { pyProcess.kill() } catch (_) {}
  }
})
