/**
 * api.js — единый модуль для всех обращений к FastAPI-серверу.
 *
 * Весь остальной код вызывает функции отсюда и не знает деталей HTTP.
 */

// Базовый адрес локального бэкенда.
const BASE = 'http://127.0.0.1:8765'

/**
 * Внутренняя функция-обёртка над fetch.
 * Делает запрос, проверяет статус и возвращает разобранный JSON.
 *
 * К каждому запросу прикладывает секретный токен (X-Palaces-Token),
 * который окно получило от главного процесса Electron — без него
 * сервер ответит 401.
 */
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }

  // Берём токен из preload-моста. Если приложение открыто не в Electron
  // (например, страница в обычном браузере) — токена не будет.
  const token = window.electronAPI?.getToken?.() || ''
  if (token) {
    headers['X-Palaces-Token'] = token
  }

  const response = await fetch(BASE + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })
  if (!response.ok) {
    throw new Error('Ошибка сервера: ' + response.status)
  }
  return response.json()
}

export const api = {
  // Поиск по базе знаний.
  search: (query, limit = 5) =>
    request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  // Список всех тем с количеством узлов.
  getTopics: () => request('/api/topics'),

  // Узлы знаний конкретной темы.
  getNodes: (topicId) => request(`/api/topics/${topicId}/nodes`),

  // Добавить запись вручную. data = {topic, subtopic, summary, detail}.
  addNote: (data) =>
    request('/api/notes', { method: 'POST', body: JSON.stringify(data) }),

  // Удалить узел знаний по id.
  deleteNode: (id) => request(`/api/nodes/${id}`, { method: 'DELETE' }),

  // Общая статистика.
  getStats: () => request('/api/stats'),

  // Последние сессии Claude Code.
  getSessions: () => request('/api/sessions'),
}
