/**
 * Library.jsx — главная страница: три колонки.
 *
 *   ┌──────────┬─────────────────┬──────────────────────┐
 *   │ Фильтры  │ Список карточек │ Читалка (NodeReader) │
 *   └──────────┴─────────────────┴──────────────────────┘
 *
 * Слева — поиск, сортировка, фильтр по темам.
 * В середине — карточки (узлы знаний), которые подходят под текущие
 * фильтры и/или поисковый запрос.
 * Справа — выбранная карточка целиком, с кнопками копирования.
 */

import { useEffect, useMemo, useState } from 'react'
import { Search, X, Zap, ArrowUpDown, Hash } from 'lucide-react'
import { api } from '../api.js'
import CopyButton from '../components/CopyButton.jsx'
import NodeReader from '../components/NodeReader.jsx'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Релевантность', searchOnly: true },
  { value: 'newest',    label: 'Сначала новые' },
  { value: 'oldest',    label: 'Сначала старые' },
  { value: 'updated',   label: 'Изменённые' },
  { value: 'topic',     label: 'По теме' },
]

const SEARCH_MODES = [
  { value: 'hybrid',   label: 'Текст + смысл', hint: 'Сочетает совпадение слов и близость по смыслу.' },
  { value: 'text',     label: 'Слова',         hint: 'Только текстовое совпадение (LIKE).' },
  { value: 'semantic', label: 'Смысл',         hint: 'Только семантика (Gemini embeddings).' },
]

export default function Library() {
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('newest')
  const [mode, setMode] = useState('hybrid')
  const [nodes, setNodes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [backfillMsg, setBackfillMsg] = useState('')

  const isSearch = query.trim().length > 0

  useEffect(() => {
    api.getTopics()
      .then((d) => setTopics(d.topics))
      .catch(() => setError('Не удалось загрузить темы — запущен ли сервер?'))
  }, [])

  useEffect(() => {
    if (!isSearch && order === 'relevance') setOrder('newest')
  }, [isSearch, order])

  useEffect(() => {
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const data = isSearch
          ? await api.search(query, {
              limit: 100,
              order,
              topicIds: selectedTopics,
              mode,
            })
          : await api.getAllNodes({
              limit: 500,
              order,
              topicIds: selectedTopics,
            })
        const list = data.results || data.nodes || []
        setNodes(list)
        if (!list.some((n) => n.id === selectedId)) {
          setSelectedId(list[0]?.id ?? null)
        }
      } catch (e) {
        setError('Ошибка загрузки: ' + e.message)
        setNodes([])
      } finally {
        setLoading(false)
      }
    }, isSearch ? 350 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, order, selectedTopics, isSearch, mode])

  async function handleBackfill() {
    setBackfillMsg('Индексирую…')
    try {
      const r = await api.backfillEmbeddings(50)
      setBackfillMsg(`Готово: ${r.embedded} узлов`)
      setTimeout(() => setBackfillMsg(''), 3000)
    } catch (e) {
      setBackfillMsg('Ошибка: ' + e.message)
    }
  }

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId],
  )

  function toggleTopic(id) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function clearFilters() {
    setSelectedTopics([])
    setQuery('')
  }

  return (
    <div className="h-full flex gap-3 p-3">
      {/* ── Колонка 1: фильтры ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-surface border border-border rounded-lg flex flex-col overflow-hidden">
        {/* Поиск. */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти в памяти…"
              className="w-full bg-bg border border-border rounded-md pl-8 pr-7 py-1.5
                         text-sm text-text placeholder:text-text-dim
                         focus:border-accent focus:outline-none transition-colors"
            />
            {isSearch && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
                title="Очистить"
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          {isSearch && (
            <div
              className="mt-2 flex gap-0.5 bg-bg border border-border rounded-md p-0.5"
              title={SEARCH_MODES.find((m) => m.value === mode)?.hint}
            >
              {SEARCH_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={
                    'flex-1 text-[10px] px-1.5 py-1 rounded transition ' +
                    (mode === m.value
                      ? 'bg-surface-2 text-text'
                      : 'text-text-muted hover:text-text')
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Сортировка. */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-dim font-medium mb-1.5">
            <ArrowUpDown size={11} strokeWidth={2} />
            Сортировка
          </div>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5
                       text-sm text-text focus:border-accent focus:outline-none transition-colors"
          >
            {SORT_OPTIONS.filter((o) => !o.searchOnly || isSearch).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Темы. */}
        <div className="flex-1 min-h-0 flex flex-col px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-dim font-medium">
              <Hash size={11} strokeWidth={2} />
              Темы
            </div>
            {(selectedTopics.length > 0 || query) && (
              <button
                onClick={clearFilters}
                className="text-[10px] text-text-dim hover:text-accent transition-colors"
              >
                сброс
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 -mr-2 pr-2">
            {topics.length === 0 && (
              <div className="text-xs text-text-dim py-2">Тем ещё нет.</div>
            )}
            {topics.map((t) => {
              const active = selectedTopics.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTopic(t.id)}
                  className={
                    'flex items-center justify-between px-2 py-1.5 rounded text-sm text-left transition-colors ' +
                    (active
                      ? 'bg-surface-2 text-text border-l-2 border-accent -ml-[2px] pl-[6px]'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text')
                  }
                >
                  <span className="truncate">{t.name}</span>
                  <span className={
                    'text-[10px] ml-2 shrink-0 font-mono ' +
                    (active ? 'text-accent' : 'text-text-dim')
                  }>
                    {t.node_count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Дозаполнить эмбеддинги. */}
        <div className="border-t border-border p-2">
          <button
            onClick={handleBackfill}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] px-2 py-1.5 rounded
                       bg-bg border border-border text-text-muted hover:text-accent hover:border-accent-dim transition-colors"
            title="Достроить смысловые векторы для старых узлов"
          >
            <Zap size={12} strokeWidth={2} />
            {backfillMsg || 'Индексировать память'}
          </button>
        </div>
      </aside>

      {/* ── Колонка 2: список карточек ──────────────────────────────────────── */}
      <section className="w-[24rem] shrink-0 bg-surface border border-border rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[11px] uppercase tracking-widest text-text-dim font-medium">
            {loading ? 'Загрузка…' : isSearch ? 'Результаты' : 'Все узлы'}
          </span>
          <span className="text-[11px] font-mono text-text-muted">
            {nodes.length}
          </span>
        </div>
        {error && (
          <div className="px-3 py-2 text-xs text-danger border-b border-border bg-bg">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {!loading && nodes.length === 0 && (
            <div className="text-center text-text-dim text-sm mt-12 px-4 leading-relaxed">
              {isSearch
                ? 'Ничего не найдено.'
                : 'Память пуста.\nНачни работать с Claude Code — узлы появятся автоматически.'}
            </div>
          )}
          {nodes.map((n) => (
            <NodeListItem
              key={n.id}
              node={n}
              active={n.id === selectedId}
              onClick={() => setSelectedId(n.id)}
              highlight={query}
            />
          ))}
        </div>
      </section>

      {/* ── Колонка 3: читалка ──────────────────────────────────────────────── */}
      <section className="flex-1 bg-surface border border-border rounded-lg overflow-hidden">
        <NodeReader
          node={selectedNode}
          highlight={query}
          onDeleted={(id) => {
            setNodes((prev) => prev.filter((n) => n.id !== id))
            setSelectedId(null)
          }}
          onUpdated={(updated) =>
            setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
          }
        />
      </section>
    </div>
  )
}

/** Одна карточка в среднем списке. */
function NodeListItem({ node, active, onClick, highlight }) {
  return (
    <div
      onClick={onClick}
      className={
        'group rounded-md p-2.5 cursor-pointer transition-colors border ' +
        (active
          ? 'bg-bg border-accent'
          : 'bg-transparent border-transparent hover:bg-bg hover:border-border')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-accent truncate font-medium">
          {node.topic} <span className="text-text-dim">·</span> {node.subtopic}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition shrink-0">
          <CopyButton compact text={node.summary} />
        </div>
      </div>
      <div className="mt-1.5 text-sm text-text leading-snug line-clamp-3">
        {highlightSnippet(node.summary, highlight)}
      </div>
    </div>
  )
}

/** Мини-подсветка для превью в списке. */
function highlightSnippet(text, highlight) {
  if (!highlight) return text
  const words = highlight.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
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
