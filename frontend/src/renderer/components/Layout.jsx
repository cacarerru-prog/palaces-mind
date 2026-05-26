/**
 * Layout.jsx — общая рамка приложения.
 *
 *   1. Титулбар сверху (frameless-окно — рисуем свой);
 *   2. Боковое меню слева;
 *   3. Область контента, куда react-router подставляет страницу.
 *
 * Палитра и иконки — в духе Claude Code: тёплый чёрный, оранжевый акцент,
 * lucide-иконки вместо эмодзи.
 */

import { NavLink, Outlet } from 'react-router-dom'
import {
  Library,
  PenLine,
  BarChart3,
  Minus,
  Square,
  X,
} from 'lucide-react'

// Пункты бокового меню: путь, иконка, подпись.
const NAV_ITEMS = [
  { to: '/library', icon: Library,   label: 'Библиотека' },
  { to: '/add',     icon: PenLine,   label: 'Добавить' },
  { to: '/stats',   icon: BarChart3, label: 'Статистика' },
]

/** Безопасно вызывает функции окна (если запущено не в Electron — молчит). */
const win = {
  minimize: () => window.electronAPI?.minimize(),
  toggleMax: () => window.electronAPI?.toggleMaximize?.(),
  close:    () => window.electronAPI?.close(),
}

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-bg text-text">
      {/* ── Титулбар. Drag — таскать окно за эту полосу. ── */}
      <div
        className="flex items-center justify-between h-8 px-3 bg-surface border-b border-border"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[12px] tracking-wide text-text-muted font-medium">
            Palaces of the Mind
          </span>
        </div>
        <div className="flex" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={win.minimize}
            className="w-10 h-8 flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
            title="Свернуть"
          >
            <Minus size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={win.toggleMax}
            className="w-10 h-8 flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
            title="Развернуть"
          >
            <Square size={12} strokeWidth={1.5} />
          </button>
          <button
            onClick={win.close}
            className="w-10 h-8 flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors"
            title="Свернуть в трей"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Нижняя часть: меню слева + контент справа. ── */}
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 bg-surface border-r border-border flex flex-col">
          <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-widest text-text-dim font-medium">
            Меню
          </div>
          <div className="flex flex-col px-2 gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ' +
                    (isActive
                      ? 'bg-surface-2 text-text border-l-2 border-accent -ml-[2px] pl-[10px]'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text')
                  }
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
          <div className="mt-auto px-4 py-3 text-[10px] text-text-dim leading-snug font-mono border-t border-border">
            v1.1 · локально · 127.0.0.1
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
