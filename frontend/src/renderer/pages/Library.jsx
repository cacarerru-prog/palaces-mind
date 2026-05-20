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
import { api } from '../api.js'
import CopyButton from '../components/CopyButton.jsx'
import NodeReader from '../components/NodeReader.jsx'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'По релевантности', searchOnly: true },
  { value: 'newest',    label: 'Сначала новые' },
  { value: 'oldest',    label: 'Сначала старые' },
  { value: 'updated',   label: 'Недавно изменённые' },
  { value: 'topic',     label: 'По теме' },
]

const SEARCH_MODES = [
  { value: 'hybrid',   label: 'Текст + смысл', hint: 'Сочетает совпадение слов и близость по смыслу.' },
  { value: 'text',     label: 'По словам',     hint: 'Только текстовое совпадение (LIKE).' },
  { value: 'semantic', label: 'По смыслу',     hint: 'Только семантика (Gemini embeddings).' },
]

export default function Library() {
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([]) // массив id
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('newest')
  const [mode, setMode] = useState('hybrid')
  const [nodes, setNodes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [backfillMsg, setBackfillMsg] = useState('')

  const isSearch = query.trim().length > 0

  // Загружаем список тем один раз.
  useEffect(() => {
    api.getTopics()
      .then((d) => setTopics(d.topics))
      .catch(() => setError('Не удалось загрузить темы — запущен ли сервер?'))
  }, [])

  // Если выбрана сортировка «relevance» вне поиска — переключаемся на «newest».
  useEffect(() => {
    if (!isSearch && order === 'relevance') setOrder('newest')
  }, [isSearch, order])

  // Главный эффект: подгружаем список карточек под текущие фильтры.
  // Поиск работает с debounce 350 мс — чтобы не дёргать сервер на каждую букву.
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
        // Если выбранная запись не пережила фильтр — сбрасываем выбор.
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
    <div className="h-full flex gap-3">
      {/* ── Колонка 1: фильтры ─────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-surface rounded-xl p-3 flex flex-col gap-3 overflow-y-auto">
        {/* Поиск. */}
        <div>
          <label className="text-[11px] uppercase text-gray-500 tracking-wider">
            Поиск
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="горутины, docker volume…"
            className="w-full mt-1 bg-bg rounded-lg px-3 py-2 outline-none
                       focus:ring-2 focus:ring-accent text-gray-100 text-sm"
          />
          {/* Режим поиска — показываем, только когда есть запрос. */}
          {isSearch && (
            <div className="mt-1.5 flex gap-1" title={SEARCH_MODES.find((m) => m.value === mode)?.hint}>
              {SEARCH_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={
                    'flex-1 text-[10px] px-1.5 py-1 rounded transition ' +
                    (mode === m.value
                      ? 'bg-accent text-white'
                      : 'bg-bg text-gray-400 hover:text-gray-100')
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Сортировка. */}
        <div>
          <label className="text-[11px] uppercase text-gray-500 tracking-wider">
            Сортировка
          </label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-full mt-1 bg-bg rounded-lg px-2.5 py-2 outline-none
                       focus:ring-2 focus:ring-accent text-gray-100 text-sm"
          >
            {SORT_OPTIONS.filter((o) => !o.searchOnly || isSearch).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по темам. */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase text-gray-500 tracking-wider">
              Темы
            </label>
            {(selectedTopics.length > 0 || query) && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-gray-400 hover:text-accent"
              >
                сброс
              </button>
            )}
          </div>
          <div className="mt-1 overflow-y-auto flex flex-col gap-0.5">
            {topics.length === 0 && (
              <div className="text-xs text-gray-500 py-2">Тем ещё нет.</div>
            )}
            {topics.map((t) => {
              const active = selectedTopics.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTopic(t.id)}
                  className={
                    'flex items-center justify-between px-2 py-1 rounded text-sm text-left ' +
                    (active
                      ? 'bg-accent text-white'
                      : 'text-gray-300 hover:bg-bg')
                  }
                >
                  <span className="truncate">{t.name}</span>
                  <span className={
                    'text-[10px] ml-2 shrink-0 ' +
                    (active ? 'text-white/80' : 'text-gray-500')
                  }>
                    {t.node_count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Дозаполнить эмбеддинги (для смыслового поиска по старым записям). */}
        <div className="border-t border-bg pt-2">
          <button
            onClick={handleBackfill}
            className="w-full text-[11px] px-2 py-1.5 rounded bg-bg text-gray-400 hover:text-accent hover:bg-bg/80 transition"
            title="Достроить смысловые векторы для старых узлов"
          >
            {backfillMsg || '⚡ Проиндексировать память'}
          </button>
        </div>
      </aside>

      {/* ── Колонка 2: список карточек ──────────────────────────────────────── */}
      <section className="w-96 shrink-0 bg-surface rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-bg">
          <span className="text-xs text-gray-400">
            {loading ? 'Загрузка…' : `Найдено: ${nodes.length}`}
          </span>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {!loading && nodes.length === 0 && (
            <div className="text-center text-gray-500 text-sm mt-8 px-4">
              {isSearch
                ? 'Ничего не найдено. Попробуй другой запрос.'
                : 'Память пуста. Начни работать с Claude Code — узлы появятся автоматически.'}
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
      <section className="flex-1 bg-surface rounded-xl p-4 overflow-hidden">
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
        'group rounded-lg p-2.5 cursor-pointer transition border ' +
        (active
          ? 'bg-bg border-accent'
          : 'bg-bg/60 border-transparent hover:bg-bg hover:border-bg')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] text-accent uppercase tracking-wide truncate">
          {node.topic} → {node.subtopic}
        </div>
        {/* Компактная кнопка копирования в правом верхнем углу карточки. */}
        <div className="opacity-0 group-hover:opacity-100 transition shrink-0">
          <CopyButton compact text={node.summary} />
        </div>
      </div>
      <div className="mt-1 text-sm text-gray-100 line-clamp-3">
        {highlightSnippet(node.summary, highlight)}
      </div>
    </div>
  )
}

/** Мини-подсветка для превью в списке (без полноценной React-разметки). */
function highlightSnippet(text, highlight) {
  if (!highlight) return text
  const words = highlight.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return text
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
