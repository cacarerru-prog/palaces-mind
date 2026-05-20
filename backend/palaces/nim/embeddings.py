"""
embeddings.py — клиент эмбеддингов через OpenAI-совместимый эндпоинт Gemini.

Эмбеддинг — числовой вектор, отражающий смысл текста. Близкие по смыслу
тексты дают близкие векторы (по косинусу), поэтому по эмбеддингам можно
искать «по смыслу», а не только по совпадению слов.

Используем модель `text-embedding-004` (Gemini): 768 чисел типа float32,
итого 768 * 4 = 3072 байта на запись. Храним эти байты в колонке
knowledge_nodes.embedding (BLOB).

При любой ошибке возвращаем None — это значит «эмбеддинга нет», и
семантический поиск просто не учтёт эту запись.
"""

import struct
from typing import Iterable

from config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_TIMEOUT,
    is_llm_key_set,
)
from palaces.utils.logger import get_logger

log = get_logger("embeddings")

# Модель эмбеддингов Gemini, доступная через OpenAI-совместимый эндпоинт.
EMBED_MODEL = "text-embedding-004"
# Максимум входного текста — отрезаем длинные detail-поля,
# чтобы не упереться в лимит токенов модели.
MAX_INPUT_CHARS = 8000


def _get_client():
    """Создаёт OpenAI-клиент, настроенный на адрес Gemini."""
    from openai import OpenAI  # локальный импорт — не падать без установки

    return OpenAI(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        timeout=LLM_TIMEOUT,
    )


def embed_text(text: str) -> list[float] | None:
    """
    Возвращает вектор-эмбеддинг текста (список из 768 чисел) или None.

    Используется на этапе сохранения узла знаний и при поиске
    по смыслу (запрос пользователя тоже превращаем в вектор).
    """
    if not is_llm_key_set():
        return None
    if not text or not text.strip():
        return None

    snippet = text[:MAX_INPUT_CHARS]
    try:
        client = _get_client()
        response = client.embeddings.create(model=EMBED_MODEL, input=snippet)
        vec = response.data[0].embedding
        return list(vec)
    except Exception as e:
        log.warning("Не удалось получить эмбеддинг: %s", e)
        return None


def pack_vector(vec: Iterable[float]) -> bytes:
    """
    Превращает вектор float-ов в компактный BLOB (4 байта на число).

    struct.pack('<{n}f', ...) пакует n чисел в формате little-endian float32.
    Это в 3 раза экономнее, чем JSON-строка тех же чисел.
    """
    vec = list(vec)
    return struct.pack(f"<{len(vec)}f", *vec)


def unpack_vector(blob: bytes | None) -> list[float] | None:
    """
    Распаковывает BLOB обратно в список float-ов. None -> None.
    """
    if not blob:
        return None
    count = len(blob) // 4
    return list(struct.unpack(f"<{count}f", blob))


def cosine(a: list[float], b: list[float]) -> float:
    """
    Косинусная близость двух векторов: 1.0 — идентичны по направлению,
    0.0 — перпендикулярны, -1.0 — противоположны.

    Чем выше, тем ближе по смыслу. Чистый Python, без numpy — чтобы не
    тащить зависимость ради 768 чисел.
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / ((na ** 0.5) * (nb ** 0.5))


def node_text_for_embedding(node: dict) -> str:
    """
    Собирает текст узла знаний для эмбеддинга.

    Включает тему, подтему, краткую суть и подробности — этого достаточно
    для смыслового поиска. Ключевые слова добавляем в конце как контекст.
    """
    parts = [
        node.get("topic", ""),
        node.get("subtopic", ""),
        node.get("summary", ""),
        node.get("detail", ""),
    ]
    kw = node.get("keywords") or []
    if kw:
        parts.append(" ".join(kw))
    return "\n".join(p for p in parts if p)
