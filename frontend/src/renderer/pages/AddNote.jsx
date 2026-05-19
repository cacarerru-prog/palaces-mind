/**
 * AddNote.jsx — страница ручного добавления записи в память.
 *
 * Поле "Тема" имеет автодополнение из уже существующих тем (через <datalist>).
 */

import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function AddNote() {
  // Поля формы.
  const [topic, setTopic] = useState('')
  const [subtopic, setSubtopic] = useState('')
  const [summary, setSummary] = useState('')
  const [detail, setDetail] = useState('')

  const [existingTopics, setExistingTopics] = useState([])  // для автодополнения
  const [message, setMessage] = useState(null)              // {text, ok}

  // Загружаем существующие темы для подсказок в поле "Тема".
  useEffect(() => {
    api
      .getTopics()
      .then((data) => setExistingTopics(data.topics.map((t) => t.name)))
      .catch(() => {})
  }, [])

  /** Отправка формы на сервер. */
  async function handleSubmit(e) {
    e.preventDefault()  // не перезагружать страницу

    // Краткая суть — обязательное поле.
    if (!summary.trim() || !topic.trim() || !subtopic.trim()) {
      setMessage({ text: 'Заполни тему, подтему и краткую суть.', ok: false })
      return
    }

    try {
      await api.addNote({ topic, subtopic, summary, detail })
      setMessage({ text: 'Запись сохранена ✓', ok: true })
      // Очищаем форму после успеха.
      setSubtopic('')
      setSummary('')
      setDetail('')
    } catch (e) {
      setMessage({ text: 'Ошибка сохранения. Запущен ли сервер?', ok: false })
    }
  }

  // Общий класс для текстовых полей.
  const fieldClass =
    'w-full bg-surface rounded-lg px-3 py-2 outline-none ' +
    'focus:ring-2 focus:ring-accent text-gray-100'

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">✏️ Добавить заметку</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Тема — с автодополнением. */}
        <div>
          <label className="text-sm text-gray-400">Тема</label>
          <input
            list="topics-list"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Go, Docker, SQL…"
            className={fieldClass}
          />
          <datalist id="topics-list">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        {/* Подтема. */}
        <div>
          <label className="text-sm text-gray-400">Подтема</label>
          <input
            value={subtopic}
            onChange={(e) => setSubtopic(e.target.value)}
            placeholder="горутины, volumes…"
            className={fieldClass}
          />
        </div>

        {/* Краткая суть (обязательно). */}
        <div>
          <label className="text-sm text-gray-400">Краткая суть *</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="Главная мысль в 1-2 предложениях"
            className={fieldClass}
          />
        </div>

        {/* Подробности (необязательно). */}
        <div>
          <label className="text-sm text-gray-400">Подробности</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={5}
            placeholder="Развёрнутое объяснение (необязательно)"
            className={fieldClass}
          />
        </div>

        <button
          type="submit"
          className="bg-accent hover:bg-accent-dim text-white rounded-lg py-2 font-medium"
        >
          Сохранить
        </button>

        {/* Сообщение об успехе или ошибке. */}
        {message && (
          <div className={message.ok ? 'text-green-400' : 'text-red-400'}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}
