"""
memory.py — роуты для работы с базой знаний (темы, узлы, заметки).

Эндпоинты:
  GET    /api/topics                — список тем с количеством узлов
  GET    /api/topics/{id}/nodes     — узлы знаний конкретной темы
  GET    /api/nodes                 — все узлы (с фильтром по темам и сортировкой)
  POST   /api/notes                 — добавить запись вручную
  PATCH  /api/nodes/{id}            — обновить summary/detail узла
  DELETE /api/nodes/{id}            — удалить узел знаний
"""

from fastapi import APIRouter
from pydantic import BaseModel

from config import DB_PATH
from palaces.db.schema import connect
from palaces.db.queries import (
    get_all_topics,
    get_nodes_by_topic,
    get_all_nodes,
    add_manual_note,
    delete_node,
    update_node,
)

router = APIRouter(prefix="/api")


class NoteIn(BaseModel):
    """Тело запроса для добавления заметки вручную."""
    topic: str
    subtopic: str
    summary: str
    detail: str = ""


class NodePatchIn(BaseModel):
    """Тело запроса для правки узла. Поля опциональны."""
    summary: str | None = None
    detail: str | None = None


def _parse_topics(value: str | None) -> list[int] | None:
    """Превращает '1,2,3' в [1,2,3]. Мусор отбрасывает."""
    if not value:
        return None
    out: list[int] = []
    for chunk in value.split(","):
        chunk = chunk.strip()
        if chunk.isdigit():
            out.append(int(chunk))
    return out or None


@router.get("/topics")
def topics() -> dict:
    """Все темы с числом узлов в каждой."""
    conn = connect(DB_PATH)
    try:
        return {"topics": get_all_topics(conn)}
    finally:
        conn.close()


@router.get("/topics/{topic_id}/nodes")
def topic_nodes(topic_id: int, order: str = "topic") -> dict:
    """Все узлы знаний заданной темы с сортировкой."""
    conn = connect(DB_PATH)
    try:
        return {"nodes": get_nodes_by_topic(conn, topic_id, order=order)}
    finally:
        conn.close()


@router.get("/nodes")
def all_nodes(
    topics: str | None = None,
    order: str = "newest",
    limit: int = 500,
) -> dict:
    """
    Возвращает все узлы — для страницы «Библиотека».

    topics  — список id тем через запятую: ?topics=1,3,7
    order   — newest | oldest | updated | topic
    limit   — верхняя граница по числу записей
    """
    topic_ids = _parse_topics(topics)
    conn = connect(DB_PATH)
    try:
        nodes = get_all_nodes(conn, topic_ids=topic_ids, order=order, limit=limit)
        return {"nodes": nodes, "order": order}
    finally:
        conn.close()


@router.post("/notes")
def create_note(note: NoteIn) -> dict:
    """Добавляет узел знаний вручную (тема/подтема создаются при нужде)."""
    conn = connect(DB_PATH)
    try:
        node_id = add_manual_note(
            conn, note.topic, note.subtopic, note.summary, note.detail
        )
        return {"status": "ok", "node_id": node_id}
    finally:
        conn.close()


@router.patch("/nodes/{node_id}")
def patch_node(node_id: int, patch: NodePatchIn) -> dict:
    """Правка summary/detail существующего узла."""
    conn = connect(DB_PATH)
    try:
        update_node(conn, node_id, summary=patch.summary, detail=patch.detail)
        return {"status": "ok"}
    finally:
        conn.close()


@router.delete("/nodes/{node_id}")
def remove_node(node_id: int) -> dict:
    """Удаляет узел знаний по id."""
    conn = connect(DB_PATH)
    try:
        delete_node(conn, node_id)
        return {"status": "ok"}
    finally:
        conn.close()
