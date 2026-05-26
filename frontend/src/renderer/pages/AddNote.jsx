/**
 * AddNote.jsx — страница ручного добавления записи в память.
 *
 * Поле "Тема" имеет автодополнение из уже существующих тем (через <datalist>).
 */

import { useState, useEffect } from 'react'
import { PenLine, Save, Check, AlertCircle } from 'lucide-react'
import { api } from '../api.js'

const FIELD_CLASS =
  'w-full bg-bg border border-border rounded-md px-3 py-2 ' +
  'text-text placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors'

const LABEL_CLASS =
  'text-[10px] uppercase tracking-widest text-text-dim font-semibold mb-1.5 block'

export default function AddNote() {
  const [topic, setTopic] = useState('')
  const [subtopic, setSubtopic] = useState('')
  const [summary, setSummary] = useState('')
  const [detail, setDetail] = useState('')

  const [existingTopics, setExistingTopics] = useState([])
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api
      .getTopics()
      .then((data) => setExistingTopics(data.topics.map((t) => t.name)))
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!summary.trim() || !topic.trim() || !subtopic.trim()) {
      setMessage({ text: 'Заполни тему, подтему и краткую суть.', ok: false })
      return
    }
    try {
      await api.addNote({ topic, subtopic, summary, detail })
      setMessage({ text: 'Запись сохранена', ok: true })
      setSubtopic('')
      setSummary('')
      setDetail('')
    } catch (e) {
      setMessage({ text: 'Ошибка сохранения. Запущен ли сервер?', ok: false })
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <PenLine size={20} strokeWidth={1.75} className="text-accent" />
        <h1 className="text-xl font-semibold text-text">Добавить заметку</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-4"
      >
        <div>
          <label className={LABEL_CLASS}>Тема</label>
          <input
            list="topics-list"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Go, Docker, SQL…"
            className={FIELD_CLASS}
          />
          <datalist id="topics-list">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={LABEL_CLASS}>Подтема</label>
          <input
            value={subtopic}
            onChange={(e) => setSubtopic(e.target.value)}
            placeholder="горутины, volumes…"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>
            Краткая суть <span className="text-accent">*</span>
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="Главная мысль в 1-2 предложениях"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Подробности</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={6}
            placeholder="Развёрнутое объяснение (необязательно)"
            className={FIELD_CLASS + ' font-mono text-sm'}
          />
        </div>

        <button
          type="submit"
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-bg rounded-md py-2.5 font-medium transition-colors"
        >
          <Save size={14} strokeWidth={2} />
          Сохранить
        </button>

        {message && (
          <div
            className={
              'flex items-center gap-2 text-sm px-3 py-2 rounded-md border ' +
              (message.ok
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger')
            }
          >
            {message.ok
              ? <Check size={14} strokeWidth={2} />
              : <AlertCircle size={14} strokeWidth={2} />}
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}
