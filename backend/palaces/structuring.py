"""
structuring.py — разбор сохранённых сессий на узлы знаний через LLM.

Раньше разбор запускался хуком on_stop на КАЖДЫЙ ответ ассистента —
получался один запрос к LLM на каждый ход диалога, что быстро съедало
бесплатный лимит.

Теперь схема такая:
  - хук on_stop только дёшево сохраняет сессию в SQLite (без LLM);
  - фоновый «уборщик» в FastAPI-сервере периодически берёт сессии,
    которые уже «затихли» (диалог завершён), и разбирает каждую ОДИН РАЗ.

Итог: один диалог = один запрос к LLM.
"""

from config import DB_PATH
from palaces.db.schema import connect
from palaces.db.queries import (
    get_stale_unprocessed_sessions,
    get_or_create_topic,
    get_or_create_subtopic,
    save_knowledge_node,
    delete_nodes_by_session,
    mark_session_processed,
)
from palaces.nim.client import parse_and_structure
from palaces.utils.logger import get_logger

log = get_logger("structuring")


def process_session(conn, session_db_id: int) -> int:
    """
    Разбирает одну сессию: её текст -> LLM -> узлы знаний в базе.

    Возвращает количество сохранённых узлов. Перед сохранением удаляет
    прежние узлы этой сессии — чтобы при повторном разборе не было дублей.
    """
    row = conn.execute(
        "SELECT raw_text FROM sessions WHERE id = ?", (session_db_id,)
    ).fetchone()

    # Нет текста — помечаем обработанной и выходим (разбирать нечего).
    if not row or not row["raw_text"]:
        mark_session_processed(conn, session_db_id)
        return 0

    # Запрос к LLM. При ошибке функция вернёт пустой список — не упадёт.
    nodes = parse_and_structure(row["raw_text"])

    # Чистим прежние узлы этой сессии и сохраняем свежий набор.
    delete_nodes_by_session(conn, session_db_id)
    for node in nodes:
        topic_id = get_or_create_topic(conn, node["topic"])
        subtopic_id = get_or_create_subtopic(conn, topic_id, node["subtopic"])
        save_knowledge_node(
            conn,
            subtopic_id=subtopic_id,
            summary=node["summary"],
            detail=node["detail"],
            keywords=node["keywords"],
            session_id=session_db_id,
        )

    # Помечаем обработанной, даже если узлов 0 — иначе уборщик будет
    # бесконечно возвращаться к этой сессии.
    mark_session_processed(conn, session_db_id)
    log.info("Сессия #%d разобрана: сохранено %d узлов", session_db_id, len(nodes))
    return len(nodes)


def process_stale_sessions(idle_minutes: int, max_count: int) -> int:
    """
    Находит «затихшие» необработанные сессии и разбирает их.

    За один вызов обрабатывает не больше max_count сессий — чтобы не
    упереться в лимит запросов LLM в минуту. Возвращает число
    разобранных сессий.
    """
    conn = connect(DB_PATH)
    try:
        stale = get_stale_unprocessed_sessions(conn, idle_minutes, max_count)
        for session in stale:
            try:
                process_session(conn, session["id"])
            except Exception as e:
                # Сбой на одной сессии не должен останавливать остальные.
                log.error("Ошибка разбора сессии #%d: %s", session["id"], e)
        return len(stale)
    finally:
        conn.close()
