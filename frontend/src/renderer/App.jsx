/**
 * App.jsx — корневой компонент. Настраивает маршрутизацию.
 *
 * HashRouter (адреса вида #/library) нужен потому что в собранном
 * Electron-приложении страница грузится через file:// — обычный
 * BrowserRouter в этом случае не работает.
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Library from './pages/Library.jsx'
import AddNote from './pages/AddNote.jsx'
import Stats from './pages/Stats.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* По умолчанию открываем «Библиотеку». */}
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="library" element={<Library />} />
          <Route path="add" element={<AddNote />} />
          <Route path="stats" element={<Stats />} />
          {/* Старые маршруты — на «Библиотеку», чтобы не падать на старых ссылках. */}
          <Route path="search" element={<Navigate to="/library" replace />} />
          <Route path="knowledge" element={<Navigate to="/library" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
