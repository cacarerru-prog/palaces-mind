/**
 * Stats.jsx — страница статистики.
 *
 * Показывает: 4 карточки с числами, простой график активности по дням
 * (рисуем сами через SVG) и таблицу последних сессий.
 */

import { useState, useEffect } from 'react'
import { BarChart3, CheckCircle2, Clock } from 'lucide-react'
import { api } from '../api.js'

/** Маленькая карточка с числом и подписью. */
function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-3xl font-semibold text-accent font-mono">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-text-dim mt-1 font-semibold">
        {label}
      </div>
    </div>
  )
}

/** Простой столбчатый график активности на чистом SVG. */
function ActivityChart({ activity }) {
  if (!activity || activity.length === 0) {
    return <div className="text-sm text-text-dim">Пока нет данных для графика.</div>
  }

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
            <rect
              x={i * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill="#d97757"
              rx="3"
            />
            <text
              x={i * (barWidth + gap) + barWidth / 2}
              y={height - barHeight - 4}
              fill="#a8a6a1"
              fontSize="9"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
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

  useEffect(() => {
    Promise.all([api.getStats(), api.getSessions()])
      .then(([statsData, sessionsData]) => {
        setStats(statsData)
        setSessions(sessionsData.sessions)
      })
      .catch(() => setError('Не удалось загрузить статистику. Запущен ли сервер?'))
  }, [])

  if (error) return <div className="p-6 text-danger text-sm">{error}</div>
  if (!stats) return <div className="p-6 text-text-dim text-sm">Загрузка…</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <BarChart3 size={20} strokeWidth={1.75} className="text-accent" />
        <h1 className="text-xl font-semibold text-text">Статистика</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Сессий" value={stats.total_sessions} />
        <StatCard label="Знаний" value={stats.total_nodes} />
        <StatCard label="Тем" value={stats.total_topics} />
        <StatCard label="Запросов" value={stats.total_queries} />
      </div>

      <h2 className="text-[10px] uppercase tracking-widest text-text-dim font-semibold mt-8 mb-2">
        Активность за 30 дней
      </h2>
      <div className="bg-surface border border-border rounded-lg p-4 overflow-x-auto">
        <ActivityChart activity={stats.activity} />
      </div>

      <h2 className="text-[10px] uppercase tracking-widest text-text-dim font-semibold mt-8 mb-2">
        Последние сессии
      </h2>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {sessions.length === 0 && (
          <div className="p-4 text-sm text-text-dim">Сессий пока нет.</div>
        )}
        {sessions.slice(0, 10).map((s) => (
          <div
            key={s.id}
            className="flex justify-between items-center px-4 py-2.5 border-b border-border last:border-0 text-sm"
          >
            <span className="text-text-muted font-mono text-[12px]">{s.started_at}</span>
            <span className="flex items-center gap-1.5 text-xs">
              {s.processed ? (
                <>
                  <CheckCircle2 size={13} strokeWidth={2} className="text-success" />
                  <span className="text-success">разобрана</span>
                </>
              ) : (
                <>
                  <Clock size={13} strokeWidth={2} className="text-text-muted" />
                  <span className="text-text-muted">в очереди</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
