/**
 * Layout.jsx — общая рамка приложения.
 *
 * Состоит из трёх частей:
 *   1. Титулбар сверху (окно без рамки — рисуем свой) с кнопками.
 *   2. Боковое меню слева с навигацией.
 *   3. Область контента, куда react-router подставляет текущую страницу.
 */

import { NavLink, Outlet } from 'react-router-dom'

// Пункты бокового меню: путь, иконка, подпись.
const NAV_ITEMS = [
  { to: '/search', icon: '🔍', label: 'Поиск' },
  { to: '/knowledge', icon: '🧠', label: 'База знаний' },
  { to: '/add', icon: '✏️', label: 'Добавить заметку' },
  { to: '/stats', icon: '📊', label: 'Статистика' },
]

/** Безопасно вызывает функции окна (если запущено не в Electron — молчит). */
const win = {
  minimize: () => window.electronAPI?.minimize(),
  close: () => window.electronAPI?.close(),
}

export default function Layout() {
  return (
    <div className="flex flex-col h-screen">
      {/* ── Титулбар. Атрибут drag позволяет таскать окно за эту полосу. ── */}
      <div
        className="flex items-center justify-between h-9 px-3 bg-surface"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-sm text-gray-400">🏛️ Palaces of the Mind</span>
        {/* Кнопки не должны быть зоной перетаскивания — отключаем drag. */}
        <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={win.minimize}
            className="w-8 h-6 text-gray-400 hover:bg-bg rounded"
          >
            —
          </button>
          <button
            onClick={win.close}
            className="w-8 h-6 text-gray-400 hover:bg-red-600 hover:text-white rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Нижняя часть: меню слева + контент справа. ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Боковое меню. */}
        <nav className="w-52 bg-surface p-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ' +
                (isActive
                  ? 'bg-accent text-white'
                  : 'text-gray-300 hover:bg-bg')
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Область контента — здесь появляется текущая страница. */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
