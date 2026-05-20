/**
 * NodeReader.jsx — правая колонка «Библиотеки»: подробный просмотр узла знаний.
 *
 * Возможности:
 *   — копирование summary, detail, keywords и всей записи целиком;
 *   — простая подсветка блоков кода в detail (тройные обратные кавычки);
 *   — режим правки (PATCH) и удаление.
 */

import { useEffect, useState } from 'react'
import { api } from '../api.js'
import CopyButton from './CopyButton.jsx'

/** Превращает текст из detail в массив React-узлов с блоками кода. */
function renderDetail(text, highlight) {
  if (!text) return null
  // Разбиваем по тройным обратным кавычкам — нечётные индексы = блоки кода.
  const parts = text.split('```')
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Внутри блока кода может быть имя языка в первой строке — отбрасываем.
      const lines = part.split('\n')
      const body = lines.slice(1).join('\n').trimEnd() || part
      return (
        <div key={i} className="relative my-2 group">
          <pre className="bg-bg rounded-lg p-3 text-xs text-gray-200 overflow-x-auto whitespace-pre">
            <code>{body}</code>
          </pre>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
            <CopyButton text={body} compact label="Копировать код" />
          </div>
        </div>
      )
    }
    // Обычный текст — подсветка совпадений запросом, если задан.
    return (
      <span key={i} className="whitespace-pre-wrap text-gray-300">
        {highlightText(part, highlight)}
      </span>
    )
  })
}

/** Подсвечивает все совпадения слов из highlight в тексте. */
function highlightText(text, highlight) {
  if (!highlight) return text
  const words = highlight
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
  if (words.length === 0) return text
  // Экранируем спецсимволы regex и собираем единый паттерн.
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-accent/40 text-gray-100 rounded px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

/** Сериализует узел в markdown — для «Копировать всю запись». */
function nodeToMarkdown(n) {
  const kw = n.keywords?.length ? `\n\nKeywords: ${n.keywords.join(', ')}` : ''
  const detail = n.detail ? `\n\n${n.detail}` : ''
  return `# ${n.topic} → ${n.subtopic}\n\n${n.summary}${detail}${kw}`
}

export default function NodeReader({ node, highlight, onDeleted, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditing(false)
    setSummary(node?.summary || '')
    setDetail(node?.detail || '')
  }, [node?.id])

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Выбери карточку слева, чтобы прочитать.
      </div>
    )
  }

  async function save() {
    setSaving(true)
    try {
      await api.patchNode(node.id, { summary, detail })
      onUpdated?.({ ...node, summary, detail })
      setEditing(false)
    } catch (e) {
      alert('Не удалось сохранить: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm('Удалить эту запись навсегда?')) return
    try {
      await api.deleteNode(node.id)
      onDeleted?.(node.id)
    } catch (e) {
      alert('Не удалось удалить: ' + e.message)
    }
  }

  const fieldClass =
    'w-full bg-bg rounded-lg px-3 py-2 outline-none ' +
    'focus:ring-2 focus:ring-accent text-gray-100'

  return (
    <div className="h-full flex flex-col">
      {/* Шапка: тема → подтема, дата, действия. */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-accent font-medium uppercase tracking-wide">
            {node.topic} → {node.subtopic}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Создано: {node.created_at}
            {node.updated_at && node.updated_at !== node.created_at && (
              <>  · Обновлено: {node.updated_at}</>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <CopyButton text={nodeToMarkdown(node)} label="Копировать всё" />
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-dim"
              >
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setSummary(node.summary || '')
                  setDetail(node.detail || '')
                }}
                className="px-2.5 py-1 text-xs rounded-md bg-bg text-gray-300 hover:bg-surface"
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-2.5 py-1 text-xs rounded-md bg-bg text-gray-300 hover:bg-surface"
              >
                Править
              </button>
              <button
                onClick={remove}
                className="px-2.5 py-1 text-xs rounded-md bg-bg text-gray-300 hover:bg-red-600 hover:text-white"
              >
                Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Содержимое — прокрутка только здесь, шапка зафиксирована. */}
      <div className="flex-1 overflow-y-auto pr-2">
        {/* Краткая суть. */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase text-gray-500 tracking-wider">
              Суть
            </span>
            {!editing && <CopyButton compact text={node.summary} />}
          </div>
          {editing ? (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className={fieldClass}
            />
          ) : (
            <p className="text-gray-100 text-base leading-relaxed">
              {highlightText(node.summary || '', highlight)}
            </p>
          )}
        </div>

        {/* Подробности (с блоками кода). */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase text-gray-500 tracking-wider">
              Подробно
            </span>
            {!editing && node.detail && <CopyButton compact text={node.detail} />}
          </div>
          {editing ? (
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={12}
              className={fieldClass + ' font-mono text-sm'}
            />
          ) : node.detail ? (
            <div className="text-sm leading-relaxed">
              {renderDetail(node.detail, highlight)}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">Без подробностей.</div>
          )}
        </div>

        {/* Ключевые слова. */}
        {node.keywords?.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase text-gray-500 tracking-wider">
                Ключевые слова
              </span>
              <CopyButton compact text={node.keywords.join(', ')} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-bg px-2 py-0.5 rounded text-gray-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
