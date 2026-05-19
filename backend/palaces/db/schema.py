"""
schema.py — создание и инициализация базы данных SQLite.

База — это один файл (data/memory.db). Здесь описаны все таблицы
и функция init_db(), которая вызывается при старте сервера.
"""

import sqlite3
from pathlib import Path

# SQL-код создания всех таблиц.
# "IF NOT EXISTS" значит: создать таблицу, только если её ещё нет —
# поэтому init_db() можно безопасно вызывать при каждом запуске.
SCHEMA_SQL = """
-- Сессии Claude Code: один диалог пользователя с ассистентом.
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT UNIQUE NOT NULL,   -- уникальный ID сессии из хука Claude
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at    DATETIME,
    raw_text    TEXT,                   -- полный текст сессии (вопросы + ответы)
    processed   INTEGER DEFAULT 0       -- 0 = ещё не разобрана LLM, 1 = разобрана
);

-- Темы верхнего уровня: "Go", "Docker", "SQL".
CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Подтемы: тема "Go" -> подтема "горутины".
CREATE TABLE IF NOT EXISTS subtopics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id    INTEGER NOT NULL REFERENCES topics(id),
    name        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic_id, name)             -- внутри одной темы подтема уникальна
);

-- Узлы знаний: конкретные факты, решения, паттерны.
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    subtopic_id  INTEGER NOT NULL REFERENCES subtopics(id),
    session_id   INTEGER REFERENCES sessions(id),  -- из какой сессии (NULL = вручную)
    summary      TEXT NOT NULL,        -- краткая суть (1-2 предложения)
    detail       TEXT,                 -- подробное объяснение
    keywords     TEXT,                 -- JSON-список слов: ["goroutine", "sync"]
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- История запросов пользователя (для поиска и статистики).
CREATE TABLE IF NOT EXISTS queries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text   TEXT NOT NULL,
    results_json TEXT,                 -- JSON с результатами поиска
    session_id   TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Индексы ускоряют поиск по часто используемым колонкам.
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_nodes(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_subtopic ON knowledge_nodes(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_session  ON knowledge_nodes(session_id);
"""


def _unicode_lower(value):
    """Приводит строку к нижнему регистру с поддержкой кириллицы."""
    return value.lower() if isinstance(value, str) else value


def connect(db_path) -> sqlite3.Connection:
    """
    Открывает соединение с базой и настраивает его.

    row_factory = sqlite3.Row позволяет обращаться к колонкам по имени
    (row["summary"]), а не по числовому индексу — так код читаемее.
    """
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    # Включаем поддержку внешних ключей (REFERENCES) — по умолчанию выключена.
    conn.execute("PRAGMA foreign_keys = ON")
    # Переопределяем встроенную функцию lower(): родная версия SQLite
    # умеет только латиницу, из-за чего поиск по русским словам был
    # чувствителен к регистру ("Горутина" != "горутина"). Подменяем её
    # на питоновскую str.lower(), которая правильно работает с кириллицей.
    conn.create_function("lower", 1, _unicode_lower, deterministic=True)
    return conn


def init_db(db_path) -> None:
    """
    Создаёт файл базы и все таблицы, если их ещё нет.

    Вызывается один раз при старте FastAPI-сервера.
    """
    # Убеждаемся, что папка для файла базы существует.
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    conn = connect(db_path)
    try:
        # executescript выполняет сразу несколько SQL-команд из строки.
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()
