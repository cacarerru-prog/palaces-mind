# Palaces of the Mind — техническое задание для Claude Code

## Контекст проекта

Это **локальная персональная система памяти** для одного пользователя (разработчика).
Система перехватывает Claude Code сессии через хуки, структурирует знания через NVIDIA NIM API,
хранит их в SQLite и предоставляет полноценный десктоп-интерфейс на Electron + React.

**Пользователь:** начинающий разработчик, пишет на Go и Python, использует Claude Code каждый день.
Комментарии в коде — **только на русском языке**.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Backend | Python 3.11+, FastAPI, SQLite (через `sqlite3` из stdlib) |
| AI | NVIDIA NIM API (OpenAI-совместимый), модель `meta/llama-3.1-8b-instruct` |
| Desktop UI | Electron 28+, React 18, Vite |
| Стилизация | Tailwind CSS |
| Хуки | Claude Code hooks (JSON через stdin/stdout) |

---

## Структура проекта

```
palaces-of-the-mind/
├── CLAUDE.md                        ← этот файл
├── backend/
│   ├── config.py                    ← все настройки в одном месте
│   ├── requirements.txt
│   ├── palaces/
│   │   ├── __init__.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── schema.py            ← создание таблиц SQLite
│   │   │   └── queries.py           ← все запросы к базе
│   │   ├── nim/
│   │   │   ├── __init__.py
│   │   │   └── client.py            ← NVIDIA NIM API клиент
│   │   ├── hooks/
│   │   │   ├── __init__.py
│   │   │   ├── on_message.py        ← hook: перехват запроса, инжект памяти
│   │   │   └── on_stop.py           ← hook: сохранение сессии
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── logger.py            ← настройка логирования
│   └── api/
│       ├── __init__.py
│       ├── main.py                  ← FastAPI приложение
│       └── routes/
│           ├── __init__.py
│           ├── memory.py            ← CRUD для записей памяти
│           ├── search.py            ← поиск по базе
│           └── stats.py             ← статистика и история сессий
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── electron-builder.yml
│   └── src/
│       ├── main/
│       │   └── index.js             ← Electron: главный процесс
│       └── renderer/
│           ├── index.html
│           ├── main.jsx
│           ├── App.jsx
│           ├── api.js               ← все вызовы к FastAPI
│           ├── pages/
│           │   ├── Search.jsx       ← страница поиска
│           │   ├── Knowledge.jsx    ← просмотр всей базы знаний
│           │   ├── AddNote.jsx      ← добавить запись вручную
│           │   └── Stats.jsx        ← статистика и история сессий
│           └── components/
│               ├── Layout.jsx       ← боковая панель + навигация
│               ├── TopicCard.jsx    ← карточка темы
│               └── SearchResult.jsx ← один результат поиска
├── data/
│   └── memory.db                    ← SQLite база (создаётся автоматически)
├── logs/
│   └── palaces.log
└── .claude/
    └── settings.json                ← конфиг хуков для Claude Code
```

---

## Задача 1 — Backend: база данных

### Файл: `backend/palaces/db/schema.py`

Создать и инициализировать SQLite базу. Функция `init_db(db_path)` вызывается при старте сервера.

**Таблицы:**

```sql
-- Сессии Claude Code
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT UNIQUE NOT NULL,   -- уникальный ID из хука Claude
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at    DATETIME,
    raw_text    TEXT,                   -- полный текст сессии (вопросы + ответы)
    processed   INTEGER DEFAULT 0       -- 0 = ещё не обработана NIM, 1 = обработана
);

-- Темы верхнего уровня (например: "Go", "Docker", "SQL")
CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Подтемы (например: тема "Go" → подтема "горутины")
CREATE TABLE IF NOT EXISTS subtopics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id    INTEGER NOT NULL REFERENCES topics(id),
    name        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic_id, name)
);

-- Узлы знаний — конкретные факты/решения/паттерны
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    subtopic_id  INTEGER NOT NULL REFERENCES subtopics(id),
    session_id   INTEGER REFERENCES sessions(id),
    summary      TEXT NOT NULL,        -- краткая суть (1-2 предложения)
    detail       TEXT,                 -- подробное объяснение
    keywords     TEXT,                 -- JSON-список ключевых слов: ["goroutine", "sync"]
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- История запросов пользователя (для поиска и статистики)
CREATE TABLE IF NOT EXISTS queries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text   TEXT NOT NULL,
    results_json TEXT,                 -- JSON с результатами поиска
    session_id   TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Также создать индексы для быстрого поиска:
```sql
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_nodes(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_subtopic ON knowledge_nodes(subtopic_id);
```

---

### Файл: `backend/palaces/db/queries.py`

Все функции принимают `conn: sqlite3.Connection` первым аргументом.

**Реализовать следующие функции:**

```python
def get_or_create_topic(conn, name: str) -> int:
    """Возвращает id темы. Если темы нет — создаёт её."""

def get_or_create_subtopic(conn, topic_id: int, name: str) -> int:
    """Возвращает id подтемы. Если нет — создаёт."""

def save_knowledge_node(conn, subtopic_id: int, summary: str,
                         detail: str, keywords: list, session_id: int = None) -> int:
    """Сохраняет узел знаний. Возвращает его id."""

def search_knowledge(conn, query: str, limit: int = 5) -> list[dict]:
    """
    Полнотекстовый поиск по summary, detail и keywords.
    Возвращает список словарей: {id, topic, subtopic, summary, detail, keywords, created_at}
    Поиск — через LIKE по каждому слову запроса.
    """

def save_session(conn, session_id: str, raw_text: str) -> int:
    """Сохраняет сессию. Возвращает её id."""

def mark_session_processed(conn, session_db_id: int):
    """Помечает сессию как обработанную (processed=1)."""

def save_query(conn, query_text: str, results: list, session_id: str = None):
    """Логирует запрос пользователя и результаты поиска."""

def get_all_topics(conn) -> list[dict]:
    """Возвращает все темы с количеством узлов знаний в каждой."""

def get_nodes_by_topic(conn, topic_id: int) -> list[dict]:
    """Возвращает все узлы знаний для заданной темы."""

def get_stats(conn) -> dict:
    """
    Возвращает статистику:
    {
        total_sessions, total_nodes, total_topics,
        total_queries, last_session_at, top_topics: [...]
    }
    """

def get_recent_sessions(conn, limit: int = 20) -> list[dict]:
    """Возвращает последние N сессий с полями: id, session_id, started_at, ended_at, processed."""

def add_manual_note(conn, topic: str, subtopic: str, summary: str, detail: str = "") -> int:
    """Добавляет запись вручную (не из сессии). Возвращает id узла."""
```

---

## Задача 2 — Backend: NVIDIA NIM клиент

### Файл: `backend/palaces/nim/client.py`

Использовать `openai` Python SDK (он совместим с NIM API).

**Функция 1: структурирование сессии**

```python
def parse_and_structure(raw_text: str) -> list[dict]:
    """
    Отправляет текст сессии в NIM.
    Возвращает список структурированных знаний:
    [
        {
            "topic": "Go",
            "subtopic": "горутины",
            "summary": "Горутины запускаются через go func()",
            "detail": "Подробное объяснение...",
            "keywords": ["goroutine", "go", "concurrency"]
        },
        ...
    ]
    """
```

Промпт для NIM (системный):
```
Ты — система структурирования знаний программиста.
Тебе дают текст диалога между разработчиком и AI-ассистентом.
Извлеки из текста ВСЕ технические знания, решения и паттерны.

Верни JSON-массив объектов. Каждый объект:
{
  "topic": "главная тема (язык/технология/концепция)",
  "subtopic": "конкретная подтема",
  "summary": "суть в 1-2 предложениях",
  "detail": "подробное объяснение для будущего использования",
  "keywords": ["ключевое_слово_1", "ключевое_слово_2"]
}

Правила:
- Только технические знания, без воды
- topic должен быть коротким: "Go", "Docker", "SQL", "Git"
- keywords — на английском, lowercase
- Если знаний нет — верни пустой массив []
- Отвечай ТОЛЬКО валидным JSON, без пояснений
```

**Функция 2: поиск релевантной памяти**

```python
def find_relevant_memory(query: str, candidates: list[dict]) -> list[dict]:
    """
    Получает запрос пользователя и список кандидатов из SQLite.
    Просит NIM отранжировать их по релевантности.
    Возвращает отфильтрованный и отсортированный список.
    
    Используется когда SQLite вернул результаты, но нужно умное ранжирование.
    Если кандидатов меньше 3 — пропускает NIM и возвращает как есть.
    """
```

**Обработка ошибок:**
- При любой ошибке API — логировать и возвращать пустой список (не падать)
- Таймаут запроса: 30 секунд
- Retry: 1 повторная попытка при сетевой ошибке

---

## Задача 3 — Backend: Claude Code хуки

### Как работают хуки Claude Code

Claude Code вызывает хук как subprocess и передаёт JSON в stdin.
Хук читает stdin, обрабатывает, пишет JSON ответ в stdout.

**Событие UserMessage** — срабатывает когда пользователь отправляет сообщение:
```json
{
  "session_id": "abc123",
  "hook_event_name": "UserMessage", 
  "message": "текст запроса пользователя"
}
```
Ответ хука для инжекта памяти:
```json
{
  "type": "memory_injection",
  "content": "## Из памяти:\n- тема: ...\n- суть: ..."
}
```
Если памяти нет — вернуть `{}` (пустой объект).

**Событие Stop** — срабатывает когда сессия завершается:
```json
{
  "session_id": "abc123",
  "hook_event_name": "Stop",
  "transcript": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```
Хук обрабатывает асинхронно (не блокирует Claude).

---

### Файл: `backend/palaces/hooks/on_message.py`

```python
#!/usr/bin/env python3
"""
on_message.py — хук UserMessage.

Когда пользователь пишет запрос в Claude Code:
1. Читаем текст запроса из stdin
2. Ищем релевантные записи в SQLite (быстрый текстовый поиск)
3. Если нашли — форматируем как "контекст из памяти"
4. Возвращаем в stdout — Claude Code добавит это к контексту сессии
"""
```

Логика:
- Открыть соединение с SQLite
- Вызвать `search_knowledge(conn, message, limit=3)`
- Если результатов нет — вернуть `{}`
- Если есть — сформировать текстовый блок:
  ```
  ## 🧠 Из твоей памяти (Palaces of the Mind):
  
  **[Тема] → [Подтема]**
  [Краткая суть]
  
  **[Тема2] → [Подтема2]**
  [Краткая суть2]
  ```
- Также логировать запрос через `save_query()`

---

### Файл: `backend/palaces/hooks/on_stop.py`

```python
#!/usr/bin/env python3
"""
on_stop.py — хук Stop.

Когда сессия Claude Code завершилась:
1. Читаем транскрипт из stdin
2. Сохраняем сырой текст в SQLite (таблица sessions)
3. Запускаем обработку через NIM в отдельном потоке (не блокируем)
4. NIM структурирует знания → сохраняем в knowledge_nodes
"""
```

Логика:
- Принять JSON из stdin
- Склеить транскрипт в один текст (роль: содержание)
- `save_session(conn, session_id, raw_text)`
- В отдельном потоке: `parse_and_structure(raw_text)` → сохранить каждый результат через `save_knowledge_node()`
- Немедленно вернуть `{}` в stdout (не ждать NIM)

---

## Задача 4 — Backend: FastAPI сервер

### Файл: `backend/api/main.py`

```python
"""
main.py — точка входа FastAPI сервера.

Запуск: python -m api.main
Сервер стартует на http://127.0.0.1:8765

При старте:
1. Инициализирует SQLite базу (init_db)
2. Подключает все роуты
3. Включает CORS (для Electron renderer process)
"""
```

CORS: разрешить все origins (localhost only, безопасно).

### Файл: `backend/api/routes/search.py`

```
GET /api/search?q=текст&limit=5
→ Возвращает список knowledge_nodes с полями: id, topic, subtopic, summary, detail, keywords, created_at
```

### Файл: `backend/api/routes/memory.py`

```
GET  /api/topics              → список всех тем с количеством узлов
GET  /api/topics/{id}/nodes   → узлы знаний по теме
POST /api/notes               → добавить запись вручную
     Body: {topic, subtopic, summary, detail}
DELETE /api/nodes/{id}        → удалить узел
```

### Файл: `backend/api/routes/stats.py`

```
GET /api/stats    → общая статистика (total_sessions, nodes, topics, queries)
GET /api/sessions → список последних 20 сессий
```

---

## Задача 5 — Frontend: Electron + React

### Файл: `frontend/src/main/index.js`

Electron главный процесс:
1. При запуске — спавнить Python процесс: `python -m api.main` из папки `../backend`
2. Ждать 2 секунды, затем создать `BrowserWindow` (1200×800, без рамки — frameless)
3. Загрузить React приложение
4. При закрытии окна — убить Python процесс
5. В dev режиме — загружать `http://localhost:5173`, в prod — собранный `dist/index.html`

### Файл: `frontend/src/renderer/api.js`

Единый модуль для всех API вызовов. Базовый URL: `http://127.0.0.1:8765`

```javascript
export const api = {
  search: (query) => fetch(`/api/search?q=${encodeURIComponent(query)}`),
  getTopics: () => fetch('/api/topics'),
  getNodes: (topicId) => fetch(`/api/topics/${topicId}/nodes`),
  addNote: (data) => fetch('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
  deleteNode: (id) => fetch(`/api/nodes/${id}`, { method: 'DELETE' }),
  getStats: () => fetch('/api/stats'),
  getSessions: () => fetch('/api/sessions'),
}
```

### Файл: `frontend/src/renderer/App.jsx`

Боковая панель с навигацией (иконки + подписи):
- 🔍 Поиск
- 🧠 База знаний  
- ✏️ Добавить заметку
- 📊 Статистика

Тёмная тема. Цветовая схема: фон `#0f0f1a`, акцент `#7c3aed` (фиолетовый).

### Страница Search.jsx

- Поле ввода с живым поиском (debounce 400ms)
- Показывать карточки результатов: тема → подтема → суть
- При клике на карточку — раскрыть подробности
- Если ничего не найдено — показать "Память пуста. Начни работать с Claude Code!"

### Страница Knowledge.jsx

- Список тем в виде аккордеона (collapsed по умолчанию)
- При раскрытии темы — показать подтемы и узлы знаний
- Кнопка удаления у каждого узла (с подтверждением)

### Страница AddNote.jsx

Форма с полями:
- Тема (text input с автодополнением из существующих тем)
- Подтема (text input)
- Краткая суть (textarea, обязательное)
- Подробности (textarea, необязательное)
- Кнопка "Сохранить"

### Страница Stats.jsx

- 4 карточки с числами: Сессий, Знаний, Тем, Запросов
- График активности по дням (последние 30 дней) — через простой SVG или Chart.js
- Таблица последних 10 сессий: дата, статус обработки (✅ / ⏳)

---

## Задача 6 — Конфиг хуков Claude Code

### Файл: `.claude/settings.json`

```json
{
  "hooks": {
    "UserMessage": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python D:\\palaces-of-the-mind\\backend\\palaces\\hooks\\on_message.py"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python D:\\palaces-of-the-mind\\backend\\palaces\\hooks\\on_stop.py"
          }
        ]
      }
    ]
  }
}
```

Этот файл нужно положить в `~/.claude/settings.json` (глобально) или в `.claude/settings.json` внутри рабочего проекта.

---

## Задача 7 — Зависимости и запуск

### Файл: `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
openai==1.30.0
python-dotenv==1.0.1
```

### Файл: `frontend/package.json`

```json
{
  "name": "palaces-of-the-mind",
  "version": "1.0.0",
  "main": "src/main/index.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"electron .\"",
    "build": "vite build && electron-builder"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "concurrently": "^8.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### Инструкция по запуску

1. Установить Python зависимости: `pip install -r backend/requirements.txt`
2. Установить Node зависимости: `cd frontend && npm install`
3. Вставить NVIDIA API ключ в `backend/config.py` (поле `NVIDIA_API_KEY`)
4. Запустить: `cd frontend && npm run dev`

---

## Важные детали реализации

### Обработка ошибок (везде)

- Все функции NIM клиента оборачивать в try/except — при ошибке логировать и возвращать пустой результат
- SQLite соединение открывать через контекстный менеджер (`with sqlite3.connect(DB_PATH) as conn`)
- Хуки никогда не должны падать с исключением — Claude Code не должен получать ошибку

### Логирование

В `utils/logger.py` настроить логгер:
- Пишет в файл `logs/palaces.log`
- Формат: `2024-01-15 10:30:00 | INFO | on_message | Найдено 3 записи для "docker"`
- Уровень: INFO

### Производительность

- Поиск в SQLite должен работать быстро (< 100ms) — использовать LIKE индексы
- NIM вызывается только при сохранении сессии (async), не при каждом запросе
- При поиске через хук — только SQLite, без NIM

---

## Порядок реализации

1. `backend/palaces/db/schema.py` — сначала база
2. `backend/palaces/db/queries.py` — функции запросов
3. `backend/palaces/nim/client.py` — NIM клиент
4. `backend/palaces/hooks/on_message.py` и `on_stop.py` — хуки
5. `backend/api/main.py` + routes — FastAPI сервер
6. `frontend/` — Electron + React UI
7. `.claude/settings.json` — подключение хуков

Начинай с задачи 1, двигайся последовательно.
После каждой задачи — проверяй что модуль можно импортировать без ошибок.
