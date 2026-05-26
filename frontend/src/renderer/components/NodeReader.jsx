/**
 * NodeReader.jsx — правая колонка «Библиотеки»: подробный просмотр узла знаний.
 *
 * Возможности:
 *   — копирование summary, detail, keywords и всей записи целиком;
 *   — простая подсветка блоков кода в detail (тройные обратные кавычки);
 *   — режим правки (PATCH) и удаление.
 */

import { useEffect, useState } from 'react'
import { Pencil, Trash2, Save, X as XIcon } from 'lucide-react'
import { api } from '../api.js'
import CopyButton from './CopyButton.jsx'

/** Превращает текст из detail в массив React-узлов с блоками кода. */
function renderDetail(text, highlight) {
  if (!text) return null
  const parts = text.split('```')
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const lines = part.split('\n')
      const body = lines.slice(1).join('\n').trimEnd() || part
      return (
        <div key={i} className="relative my-3 group">
          <pre className="bg-bg border border-border rounded-md p-3 text-xs text-text overflow-x-auto whitespace-pre font-mono">
            <code>{body}</code>
          </pre>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
            <CopyButton text={body} compact label="Копировать код" />
          </div>
        </div>
      )
    }
    return (
      <span key={i} className="whitespace-pre-wrap text-text-muted">
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
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-accent/30 text-text rounded px-0.5">
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

const FIELD_CLASS =
  'w-full bg-bg border border-border rounded-md px-3 py-2 ' +
  'text-text placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors'

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
      <div className="h-full flex items-center justify-center text-text-dim text-sm">
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

  return (
    <div className="h-full flex flex-col">
      {/* Шапка: тема → подтема, дата, действия. */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-accent font-semibold">
            {node.topic} <span className="text-text-dim">·</span> {node.subtopic}
          </div>
          <div className="text-[11px] text-text-dim mt-1 font-mono">
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
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-accent text-bg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <Save size={12} strokeWidth={2} />
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setSummary(node.summary || '')
                  setDetail(node.detail || '')
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-bg text-text-muted hover:text-text hover:border-border-strong transition-colors"
              >
                <XIcon size={12} strokeWidth={2} />
                Отмена
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-bg text-text-muted hover:text-text hover:border-border-strong transition-colors"
              >
                <Pencil size={12} strokeWidth={1.75} />
                Править
              </button>
              <button
                onClick={remove}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-bg text-text-muted hover:bg-danger hover:text-white hover:border-danger transition-colors"
              >
                <Trash2 size={12} strokeWidth={1.75} />
                Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Содержимое — прокрутка только здесь. */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Краткая суть. */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase text-text-dim tracking-widest font-semibold">
              Суть
            </span>
            {!editing && <CopyButton compact text={node.summary} />}
          </div>
          {editing ? (
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
            />
          ) : (
            <p className="text-text text-[15px] leading-relaxed">
              {highlightText(node.summary || '', highlight)}
            </p>
          )}
        </section>

        {/* Подробности. */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase text-text-dim tracking-widest font-semibold">
              Подробно
            </span>
            {!editing && node.detail && <CopyButton compact text={node.detail} />}
          </div>
          {editing ? (
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={12}
              className={FIELD_CLASS + ' font-mono text-sm'}
            />
          ) : node.detail ? (
            <div className="text-sm leading-relaxed">
              {renderDetail(node.detail, highlight)}
            </div>
          ) : (
            <div className="text-sm text-text-dim italic">Без подробностей.</div>
          )}
        </section>

        {/* Ключевые слова. */}
        {node.keywords?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase text-text-dim tracking-widest font-semibold">
                Ключевые слова
              </span>
              <CopyButton compact text={node.keywords.join(', ')} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[11px] font-mono bg-bg border border-border px-2 py-0.5 rounded text-text-muted"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
