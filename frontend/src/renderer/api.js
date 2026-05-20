/**
 * api.js — единый модуль для всех обращений к FastAPI-серверу.
 *
 * Весь остальной код вызывает функции отсюда и не знает деталей HTTP.
 */

// Базовый адрес локального бэкенда.
const BASE = 'http://127.0.0.1:8765'

/**
 * Обёртка над fetch: ставит токен, проверяет статус, парсит JSON.
 *
 * Секретный токен (X-Palaces-Token) кладёт preload-мост Electron. Если
 * приложение открыто не в Electron (обычный браузер) — токена не будет,
 * и сервер с пустым токеном пустит без проверки.
 */
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = window.electronAPI?.getToken?.() || ''
  if (token) headers['X-Palaces-Token'] = token

  const response = await fetch(BASE + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })
  if (!response.ok) {
    throw new Error('Ошибка сервера: ' + response.status)
  }
  return response.json()
}

/** Превращает массив id тем в строку '1,2,3' для query-параметра. */
function topicsParam(topicIds) {
  if (!topicIds || topicIds.length === 0) return ''
  return '&topics=' + topicIds.join(',')
}

export const api = {
  /** Поиск. mode: text | semantic | hybrid (по умолчанию). */
  search: (
    query,
    { limit = 50, order = 'relevance', topicIds = [], mode = 'hybrid' } = {},
  ) =>
    request(
      `/api/search?q=${encodeURIComponent(query)}&limit=${limit}&order=${order}&mode=${mode}${topicsParam(topicIds)}`,
    ),

  /** Достроить эмбеддинги для узлов, у которых их ещё нет. */
  backfillEmbeddings: (batch = 25) =>
    request(`/api/embeddings/backfill?batch=${batch}`, { method: 'POST' }),

  /** Все узлы знаний (с фильтром и сортировкой). */
  getAllNodes: ({ limit = 500, order = 'newest', topicIds = [] } = {}) =>
    request(`/api/nodes?limit=${limit}&order=${order}${topicsParam(topicIds)}`),

  /** Список всех тем с количеством узлов. */
  getTopics: () => request('/api/topics'),

  /** Узлы знаний конкретной темы. */
  getNodes: (topicId, order = 'topic') =>
    request(`/api/topics/${topicId}/nodes?order=${order}`),

  /** Добавить запись вручную. data = {topic, subtopic, summary, detail}. */
  addNote: (data) =>
    request('/api/notes', { method: 'POST', body: JSON.stringify(data) }),

  /** Обновить summary/detail узла. */
  patchNode: (id, data) =>
    request(`/api/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  /** Удалить узел знаний по id. */
  deleteNode: (id) => request(`/api/nodes/${id}`, { method: 'DELETE' }),

  /** Общая статистика. */
  getStats: () => request('/api/stats'),

  /** Последние сессии Claude Code. */
  getSessions: () => request('/api/sessions'),
}
