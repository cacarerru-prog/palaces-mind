/**
 * App.jsx — корневой компонент. Настраивает маршрутизацию между страницами.
 *
 * Используем HashRouter (адреса вида #/search), потому что в собранном
 * Electron-приложении страница грузится через file:// — обычный
 * BrowserRouter в таком случае не работает.
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Search from './pages/Search.jsx'
import Knowledge from './pages/Knowledge.jsx'
import AddNote from './pages/AddNote.jsx'
import Stats from './pages/Stats.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Layout рисует рамку (титулбар + меню), внутрь подставляются страницы. */}
        <Route path="/" element={<Layout />}>
          {/* По умолчанию открываем страницу поиска. */}
          <Route index element={<Navigate to="/search" replace />} />
          <Route path="search" element={<Search />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="add" element={<AddNote />} />
          <Route path="stats" element={<Stats />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
