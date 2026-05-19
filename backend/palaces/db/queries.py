"""
queries.py — все запросы к базе данных в одном месте.

Каждая функция первым аргументом принимает уже открытое
соединение conn (sqlite3.Connection). Так удобнее: вызывающий код
сам решает, когда открыть и закрыть соединение.
"""

import json
import sqlite3


# ─── Темы и подтемы ─────────────────────────────────────────────────────────

def get_or_create_topic(conn: sqlite3.Connection, name: str) -> int:
    """Возвращает id темы. Если темы с таким именем нет — создаёт её."""
    name = name.strip()
    row = conn.execute("SELECT id FROM topics WHERE name = ?", (name,)).fetchone()
    if row:
        return row["id"]
    cur = conn.execute("INSERT INTO topics (name) VALUES (?)", (name,))
    conn.commit()
    return cur.lastrowid


def get_or_create_subtopic(conn: sqlite3.Connection, topic_id: int, name: str) -> int:
    """Возвращает id подтемы внутри темы. Если нет — создаёт."""
    name = name.strip()
    row = conn.execute(
        "SELECT id FROM subtopics WHERE topic_id = ? AND name = ?",
        (topic_id, name),
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO subtopics (topic_id, name) VALUES (?, ?)",
        (topic_id, name),
    )
    conn.commit()
    return cur.lastrowid


# ─── Узлы знаний ────────────────────────────────────────────────────────────

def save_knowledge_node(
    conn: sqlite3.Connection,
    subtopic_id: int,
    summary: str,
    detail: str,
    keywords: list,
    session_id: int = None,
) -> int:
    """
    Сохраняет один узел знаний. Возвращает его id.

    keywords — это список строк, в базе он хранится как JSON-текст.
    """
    keywords_json = json.dumps(keywords or [], ensure_ascii=False)
    cur = conn.execute(
        """INSERT INTO knowledge_nodes (subtopic_id, session_id, summary, detail, keywords)
           VALUES (?, ?, ?, ?, ?)""",
        (subtopic_id, session_id, summary, detail, keywords_json),
    )
    conn.commit()
    return cur.lastrowid


def add_manual_note(
    conn: sqlite3.Connection,
    topic: str,
    subtopic: str,
    summary: str,
    detail: str = "",
) -> int:
    """
    Добавляет запись вручную (не из сессии Claude).

    Сама создаёт тему и подтему, если их ещё нет, и сохраняет узел.
    """
    topic_id = get_or_create_topic(conn, topic)
    subtopic_id = get_or_create_subtopic(conn, topic_id, subtopic)
    return save_knowledge_node(conn, subtopic_id, summary, detail, [], session_id=None)


def delete_node(conn: sqlite3.Connection, node_id: int) -> None:
    """Удаляет узел знаний по его id."""
    conn.execute("DELETE FROM knowledge_nodes WHERE id = ?", (node_id,))
    conn.commit()


def delete_nodes_by_session(conn: sqlite3.Connection, session_db_id: int) -> None:
    """
    Удаляет все узлы знаний, привязанные к сессии.

    Нужно, чтобы при повторной обработке одной и той же сессии
    не накапливались дубли — старые узлы убираем, новые сохраняем.
    """
    conn.execute("DELETE FROM knowledge_nodes WHERE session_id = ?", (session_db_id,))
    conn.commit()


# ─── Поиск ──────────────────────────────────────────────────────────────────

def search_knowledge(conn: sqlite3.Connection, query: str, limit: int = 5) -> list[dict]:
    """
    Текстовый поиск по узлам знаний.

    Запрос разбивается на слова, и узел попадает в результат, если
    ХОТЯ БЫ одно слово встречается в summary, detail или keywords.
    Возвращает список словарей с темой и подтемой.
    """
    # Берём слова длиной больше 2 символов (короткие — мусорные предлоги).
    words = [w for w in query.lower().split() if len(w) > 2]
    if not words:
        return []

    # Для каждого слова собираем условие LIKE по трём колонкам.
    conditions = []
    params = []
    for w in words:
        like = f"%{w}%"
        conditions.append(
            "(LOWER(k.summary) LIKE ? OR LOWER(k.detail) LIKE ? OR LOWER(k.keywords) LIKE ?)"
        )
        params.extend([like, like, like])

    sql = f"""
        SELECT k.id, t.name AS topic, s.name AS subtopic,
               k.summary, k.detail, k.keywords, k.created_at
        FROM knowledge_nodes k
        JOIN subtopics s ON k.subtopic_id = s.id
        JOIN topics    t ON s.topic_id = t.id
        WHERE {' OR '.join(conditions)}
        ORDER BY k.created_at DESC
        LIMIT ?
    """
    params.append(limit)

    rows = conn.execute(sql, params).fetchall()
    return [_node_row_to_dict(r) for r in rows]


def _node_row_to_dict(row: sqlite3.Row) -> dict:
    """Превращает строку результата в словарь, разбирая keywords из JSON."""
    try:
        keywords = json.loads(row["keywords"]) if row["keywords"] else []
    except (json.JSONDecodeError, TypeError):
        keywords = []
    return {
        "id": row["id"],
        "topic": row["topic"],
        "subtopic": row["subtopic"],
        "summary": row["summary"],
        "detail": row["detail"],
        "keywords": keywords,
        "created_at": row["created_at"],
    }


# ─── Сессии ─────────────────────────────────────────────────────────────────

def save_session(conn: sqlite3.Connection, session_id: str, raw_text: str) -> int:
    """
    Сохраняет (или обновляет) сессию. Возвращает её внутренний id.

    Хук Stop срабатывает несколько раз за одну сессию, поэтому
    используем "upsert": при повторном session_id обновляем raw_text,
    а не создаём дубль.
    """
    conn.execute(
        """INSERT INTO sessions (session_id, raw_text, ended_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(session_id)
           DO UPDATE SET raw_text = excluded.raw_text,
                         ended_at = CURRENT_TIMESTAMP,
                         processed = 0""",
        (session_id, raw_text),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id FROM sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    return row["id"]


def mark_session_processed(conn: sqlite3.Connection, session_db_id: int) -> None:
    """Помечает сессию как обработанную LLM (processed = 1)."""
    conn.execute(
        "UPDATE sessions SET processed = 1 WHERE id = ?", (session_db_id,)
    )
    conn.commit()


def get_recent_sessions(conn: sqlite3.Connection, limit: int = 20) -> list[dict]:
    """Возвращает последние N сессий, новые — первыми."""
    rows = conn.execute(
        """SELECT id, session_id, started_at, ended_at, processed
           FROM sessions
           ORDER BY started_at DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_stale_unprocessed_sessions(
    conn: sqlite3.Connection,
    idle_minutes: int = 5,
    limit: int = 3,
) -> list[dict]:
    """
    Возвращает необработанные сессии, которые «молчат» дольше idle_minutes.

    Если по сессии давно (idle_minutes) не было обновлений — значит диалог
    скорее всего завершён, и её можно отдавать на разбор в LLM.
    Время в SQLite — UTC, поэтому сравниваем с datetime('now') (тоже UTC).
    """
    rows = conn.execute(
        """SELECT id, session_id, ended_at
           FROM sessions
           WHERE processed = 0
             AND raw_text IS NOT NULL
             AND ended_at <= datetime('now', ?)
           ORDER BY ended_at
           LIMIT ?""",
        (f"-{idle_minutes} minutes", limit),
    ).fetchall()
    return [dict(r) for r in rows]


# ─── Запросы пользователя ───────────────────────────────────────────────────

def save_query(
    conn: sqlite3.Connection,
    query_text: str,
    results: list,
    session_id: str = None,
) -> None:
    """Записывает в историю один запрос пользователя и его результаты."""
    results_json = json.dumps(results or [], ensure_ascii=False)
    conn.execute(
        "INSERT INTO queries (query_text, results_json, session_id) VALUES (?, ?, ?)",
        (query_text, results_json, session_id),
    )
    conn.commit()


# ─── Выборки для интерфейса ─────────────────────────────────────────────────

def get_all_topics(conn: sqlite3.Connection) -> list[dict]:
    """Возвращает все темы вместе с количеством узлов знаний в каждой."""
    rows = conn.execute(
        """SELECT t.id, t.name,
                  COUNT(k.id) AS node_count
           FROM topics t
           LEFT JOIN subtopics s ON s.topic_id = t.id
           LEFT JOIN knowledge_nodes k ON k.subtopic_id = s.id
           GROUP BY t.id, t.name
           ORDER BY node_count DESC, t.name"""
    ).fetchall()
    return [dict(r) for r in rows]


def get_nodes_by_topic(conn: sqlite3.Connection, topic_id: int) -> list[dict]:
    """Возвращает все узлы знаний заданной темы (с названием подтемы)."""
    rows = conn.execute(
        """SELECT k.id, t.name AS topic, s.name AS subtopic,
                  k.summary, k.detail, k.keywords, k.created_at
           FROM knowledge_nodes k
           JOIN subtopics s ON k.subtopic_id = s.id
           JOIN topics    t ON s.topic_id = t.id
           WHERE t.id = ?
           ORDER BY s.name, k.created_at DESC""",
        (topic_id,),
    ).fetchall()
    return [_node_row_to_dict(r) for r in rows]


def get_stats(conn: sqlite3.Connection) -> dict:
    """
    Собирает общую статистику для страницы "Статистика":
    количество сессий, узлов, тем, запросов, дата последней сессии
    и топ-5 тем по числу узлов.
    """
    def count(table: str) -> int:
        return conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]

    last_row = conn.execute(
        "SELECT MAX(started_at) AS last FROM sessions"
    ).fetchone()

    top_rows = conn.execute(
        """SELECT t.name,
                  COUNT(k.id) AS node_count
           FROM topics t
           LEFT JOIN subtopics s ON s.topic_id = t.id
           LEFT JOIN knowledge_nodes k ON k.subtopic_id = s.id
           GROUP BY t.id, t.name
           ORDER BY node_count DESC
           LIMIT 5"""
    ).fetchall()

    return {
        "total_sessions": count("sessions"),
        "total_nodes": count("knowledge_nodes"),
        "total_topics": count("topics"),
        "total_queries": count("queries"),
        "last_session_at": last_row["last"],
        "top_topics": [dict(r) for r in top_rows],
    }


def get_daily_activity(conn: sqlite3.Connection, days: int = 30) -> list[dict]:
    """
    Возвращает количество добавленных узлов знаний по дням
    за последние N дней — для графика активности.
    """
    rows = conn.execute(
        """SELECT DATE(created_at) AS day, COUNT(*) AS count
           FROM knowledge_nodes
           WHERE created_at >= DATE('now', ?)
           GROUP BY DATE(created_at)
           ORDER BY day""",
        (f"-{days} days",),
    ).fetchall()
    return [dict(r) for r in rows]
