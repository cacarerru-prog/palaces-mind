"""
stats.py — роуты статистики и истории сессий.

Эндпоинты:
  GET /api/stats     — общая статистика + активность по дням
  GET /api/sessions  — последние сессии
"""

from fastapi import APIRouter

from config import DB_PATH
from palaces.db.schema import connect
from palaces.db.queries import get_stats, get_recent_sessions, get_daily_activity

router = APIRouter(prefix="/api")


@router.get("/stats")
def stats() -> dict:
    """
    Возвращает общую статистику для страницы "Статистика":
    числа по таблицам, топ-темы и активность по дням за 30 дней.
    """
    conn = connect(DB_PATH)
    try:
        data = get_stats(conn)
        data["activity"] = get_daily_activity(conn, days=30)
        return data
    finally:
        conn.close()


@router.get("/sessions")
def sessions() -> dict:
    """Возвращает последние 20 сессий Claude Code."""
    conn = connect(DB_PATH)
    try:
        return {"sessions": get_recent_sessions(conn, limit=20)}
    finally:
        conn.close()
