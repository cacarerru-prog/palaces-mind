/**
 * Layout.jsx — общая рамка приложения.
 *
 *   1. Титулбар сверху (frameless-окно — рисуем свой);
 *   2. Боковое меню слева;
 *   3. Область контента, куда react-router подставляет страницу.
 */

import { NavLink, Outlet } from 'react-router-dom'

// Пункты бокового меню: путь, иконка, подпись.
const NAV_ITEMS = [
  { to: '/library', icon: '📚', label: 'Библиотека' },
  { to: '/add',     icon: '✏️', label: 'Добавить' },
  { to: '/stats',   icon: '📊', label: 'Статистика' },
]

/** Безопасно вызывает функции окна (если запущено не в Electron — молчит). */
const win = {
  minimize: () => window.electronAPI?.minimize(),
  toggleMax: () => window.electronAPI?.toggleMaximize?.(),
  close:    () => window.electronAPI?.close(),
}

export default function Layout() {
  return (
    <div className="flex flex-col h-screen">
      {/* ── Титулбар. Drag — таскать окно за эту полосу. ── */}
      <div
        className="flex items-center justify-between h-9 px-3 bg-surface border-b border-bg"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-sm text-gray-300 font-medium">
          🏛️ Palaces of the Mind
        </span>
        <div className="flex gap-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={win.minimize}
            className="w-9 h-7 text-gray-400 hover:bg-bg rounded text-xs"
            title="Свернуть"
          >
            ─
          </button>
          <button
            onClick={win.toggleMax}
            className="w-9 h-7 text-gray-400 hover:bg-bg rounded text-xs"
            title="Развернуть"
          >
            ▢
          </button>
          <button
            onClick={win.close}
            className="w-9 h-7 text-gray-400 hover:bg-red-600 hover:text-white rounded text-xs"
            title="Свернуть в трей"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Нижняя часть: меню слева + контент справа. ── */}
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-44 bg-surface p-2 flex flex-col gap-1 border-r border-bg">
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
              <span className="text-base">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
          <div className="mt-auto px-2 py-1 text-[10px] text-gray-600 leading-snug">
            v1.1 · локально · 127.0.0.1
          </div>
        </nav>

        <main className="flex-1 overflow-hidden p-3">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
