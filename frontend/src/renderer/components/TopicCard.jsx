/**
 * TopicCard.jsx — карточка одной темы на странице "База знаний".
 *
 * Работает как аккордеон: по клику на заголовок раскрывает список
 * узлов знаний этой темы. Узлы подгружаются с сервера при первом раскрытии.
 */

import { useState } from 'react'
import { api } from '../api.js'

export default function TopicCard({ topic }) {
  const [open, setOpen] = useState(false)        // раскрыта ли тема
  const [nodes, setNodes] = useState(null)       // узлы (null = ещё не грузили)
  const [loading, setLoading] = useState(false)

  /** Загружает узлы темы с сервера (один раз). */
  async function loadNodes() {
    setLoading(true)
    try {
      const data = await api.getNodes(topic.id)
      setNodes(data.nodes)
    } catch (e) {
      setNodes([])
    } finally {
      setLoading(false)
    }
  }

  /** Клик по заголовку: раскрыть/свернуть, при первом раскрытии — загрузить. */
  function toggle() {
    const next = !open
    setOpen(next)
    if (next && nodes === null) loadNodes()
  }

  /** Удаляет узел знаний после подтверждения. */
  async function handleDelete(nodeId) {
    if (!window.confirm('Удалить эту запись?')) return
    await api.deleteNode(nodeId)
    // Убираем удалённый узел из списка локально.
    setNodes(nodes.filter((n) => n.id !== nodeId))
  }

  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      {/* Заголовок темы. */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg/50"
      >
        <span className="font-medium">
          {open ? '▾' : '▸'} {topic.name}
        </span>
        <span className="text-xs text-gray-400">{topic.node_count} записей</span>
      </button>

      {/* Содержимое — видно только когда тема раскрыта. */}
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {loading && <div className="text-sm text-gray-400">Загрузка…</div>}

          {nodes && nodes.length === 0 && !loading && (
            <div className="text-sm text-gray-500">В этой теме пока пусто.</div>
          )}

          {nodes &&
            nodes.map((node) => (
              <div key={node.id} className="bg-bg rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-accent mb-1">{node.subtopic}</div>
                    <div className="text-sm text-gray-100">{node.summary}</div>
                    {node.detail && (
                      <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
                        {node.detail}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="text-gray-500 hover:text-red-500 shrink-0"
                    title="Удалить"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
