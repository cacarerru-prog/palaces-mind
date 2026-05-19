/**
 * Search.jsx — страница поиска по базе знаний.
 *
 * Поиск "живой": результаты обновляются по мере ввода, но с задержкой
 * 400 мс (debounce) — чтобы не дёргать сервер на каждую букву.
 */

import { useState, useEffect } from 'react'
import { api } from '../api.js'
import SearchResult from '../components/SearchResult.jsx'

export default function Search() {
  const [query, setQuery] = useState('')        // текст в поле ввода
  const [results, setResults] = useState([])    // найденные узлы
  const [searched, setSearched] = useState(false)  // был ли уже поиск
  const [error, setError] = useState('')

  // Этот эффект запускается при каждом изменении query.
  useEffect(() => {
    // Пустой запрос — очищаем результаты, ничего не ищем.
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    // Ставим таймер на 400 мс. Если пользователь продолжит печатать,
    // эффект перезапустится и старый таймер отменится (return ниже).
    const timer = setTimeout(async () => {
      try {
        const data = await api.search(query)
        setResults(data.results)
        setSearched(true)
        setError('')
      } catch (e) {
        setError('Не удалось связаться с сервером. Запущен ли бэкенд?')
      }
    }, 400)

    // Функция очистки: отменяет таймер, если query изменился раньше срока.
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">🔍 Поиск по памяти</h1>

      {/* Поле ввода запроса. */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Что ищем? Например: горутины, docker volume…"
        className="w-full bg-surface rounded-xl px-4 py-3 outline-none
                   focus:ring-2 focus:ring-accent text-gray-100"
        autoFocus
      />

      {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

      {/* Список результатов. */}
      <div className="mt-4 flex flex-col gap-3">
        {results.map((node) => (
          <SearchResult key={node.id} node={node} />
        ))}
      </div>

      {/* Подсказка, когда поиск был, но ничего не нашлось. */}
      {searched && results.length === 0 && !error && (
        <div className="mt-8 text-center text-gray-500">
          Ничего не найдено. Память наполняется автоматически,
          когда ты работаешь с Claude Code.
        </div>
      )}
    </div>
  )
}
