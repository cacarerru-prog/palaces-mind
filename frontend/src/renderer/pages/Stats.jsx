/**
 * Stats.jsx — страница статистики.
 *
 * Показывает: 4 карточки с числами, простой график активности по дням
 * (рисуем сами через SVG) и таблицу последних сессий.
 */

import { useState, useEffect } from 'react'
import { api } from '../api.js'

/** Маленькая карточка с числом и подписью. */
function StatCard({ label, value }) {
  return (
    <div className="bg-surface rounded-xl p-4 text-center">
      <div className="text-3xl font-bold text-accent">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  )
}

/** Простой столбчатый график активности на чистом SVG. */
function ActivityChart({ activity }) {
  if (!activity || activity.length === 0) {
    return <div className="text-sm text-gray-500">Пока нет данных для графика.</div>
  }

  // Максимум нужен, чтобы масштабировать высоту столбиков.
  const max = Math.max(...activity.map((d) => d.count), 1)
  const barWidth = 18
  const gap = 6
  const height = 100
  const width = activity.length * (barWidth + gap)

  return (
    <svg width={width} height={height + 20}>
      {activity.map((d, i) => {
        const barHeight = (d.count / max) * height
        return (
          <g key={d.day}>
            {/* Столбик. */}
            <rect
              x={i * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill="#7c3aed"
              rx="3"
            />
            {/* Число над столбиком. */}
            <text
              x={i * (barWidth + gap) + barWidth / 2}
              y={height - barHeight - 4}
              fill="#9ca3af"
              fontSize="9"
              textAnchor="middle"
            >
              {d.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')

  // Грузим статистику и список сессий при открытии страницы.
  useEffect(() => {
    Promise.all([api.getStats(), api.getSessions()])
      .then(([statsData, sessionsData]) => {
        setStats(statsData)
        setSessions(sessionsData.sessions)
      })
      .catch(() => setError('Не удалось загрузить статистику. Запущен ли сервер?'))
  }, [])

  if (error) return <div className="text-red-400">{error}</div>
  if (!stats) return <div className="text-gray-400">Загрузка…</div>

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">📊 Статистика</h1>

      {/* Четыре карточки с числами. */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Сессий" value={stats.total_sessions} />
        <StatCard label="Знаний" value={stats.total_nodes} />
        <StatCard label="Тем" value={stats.total_topics} />
        <StatCard label="Запросов" value={stats.total_queries} />
      </div>

      {/* График активности. */}
      <h2 className="text-lg font-medium mt-6 mb-2">Активность за 30 дней</h2>
      <div className="bg-surface rounded-xl p-4 overflow-x-auto">
        <ActivityChart activity={stats.activity} />
      </div>

      {/* Таблица последних сессий. */}
      <h2 className="text-lg font-medium mt-6 mb-2">Последние сессии</h2>
      <div className="bg-surface rounded-xl overflow-hidden">
        {sessions.length === 0 && (
          <div className="p-4 text-sm text-gray-500">Сессий пока нет.</div>
        )}
        {sessions.slice(0, 10).map((s) => (
          <div
            key={s.id}
            className="flex justify-between px-4 py-2 border-b border-bg last:border-0 text-sm"
          >
            <span className="text-gray-300">{s.started_at}</span>
            {/* processed = 1 — разобрана NIM, иначе ещё в очереди. */}
            <span>{s.processed ? '✅ разобрана' : '⏳ в очереди'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
