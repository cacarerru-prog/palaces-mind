/**
 * Knowledge.jsx — страница "База знаний".
 * Показывает все темы списком-аккордеоном (через компонент TopicCard).
 */

import { useState, useEffect } from 'react'
import { api } from '../api.js'
import TopicCard from '../components/TopicCard.jsx'

export default function Knowledge() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Загружаем список тем один раз при открытии страницы.
  useEffect(() => {
    api
      .getTopics()
      .then((data) => setTopics(data.topics))
      .catch(() => setError('Не удалось загрузить темы. Запущен ли сервер?'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">🧠 База знаний</h1>

      {loading && <div className="text-gray-400">Загрузка…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && topics.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          Пока нет ни одной темы. Начни работать с Claude Code —
          или добавь заметку вручную.
        </div>
      )}

      {/* Список тем-аккордеонов. */}
      <div className="flex flex-col gap-2">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  )
}
