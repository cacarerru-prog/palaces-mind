"""
memory.py — роуты для работы с базой знаний (темы, узлы, заметки).

Эндпоинты:
  GET    /api/topics              — список тем с количеством узлов
  GET    /api/topics/{id}/nodes   — узлы знаний конкретной темы
  POST   /api/notes               — добавить запись вручную
  DELETE /api/nodes/{id}          — удалить узел знаний
"""

from fastapi import APIRouter
from pydantic import BaseModel

from config import DB_PATH
from palaces.db.schema import connect
from palaces.db.queries import (
    get_all_topics,
    get_nodes_by_topic,
    add_manual_note,
    delete_node,
)

router = APIRouter(prefix="/api")


class NoteIn(BaseModel):
    """Модель тела запроса для добавления заметки вручную."""
    topic: str
    subtopic: str
    summary: str
    detail: str = ""


@router.get("/topics")
def topics() -> dict:
    """Возвращает все темы вместе с числом узлов в каждой."""
    conn = connect(DB_PATH)
    try:
        return {"topics": get_all_topics(conn)}
    finally:
        conn.close()


@router.get("/topics/{topic_id}/nodes")
def topic_nodes(topic_id: int) -> dict:
    """Возвращает все узлы знаний заданной темы."""
    conn = connect(DB_PATH)
    try:
        return {"nodes": get_nodes_by_topic(conn, topic_id)}
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


@router.delete("/nodes/{node_id}")
def remove_node(node_id: int) -> dict:
    """Удаляет узел знаний по id."""
    conn = connect(DB_PATH)
    try:
        delete_node(conn, node_id)
        return {"status": "ok"}
    finally:
        conn.close()
