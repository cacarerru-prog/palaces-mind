"""
search.py — роут поиска по базе знаний.

Эндпоинт:
  GET /api/search?q=текст&limit=5
"""

from fastapi import APIRouter

from config import DB_PATH, MAX_SEARCH_RESULTS
from palaces.db.schema import connect
from palaces.db.queries import search_knowledge

# APIRouter — это группа эндпоинтов. Префикс /api добавляется к каждому пути.
router = APIRouter(prefix="/api")


@router.get("/search")
def search(q: str = "", limit: int = MAX_SEARCH_RESULTS) -> dict:
    """
    Ищет узлы знаний по тексту запроса q.

    Возвращает {"query": ..., "results": [...]}.
    Если q пустой — отдаёт пустой список.
    """
    if not q.strip():
        return {"query": q, "results": []}

    conn = connect(DB_PATH)
    try:
        results = search_knowledge(conn, q, limit=limit)
    finally:
        conn.close()

    return {"query": q, "results": results}
