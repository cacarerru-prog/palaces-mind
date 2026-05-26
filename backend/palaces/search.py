"""
palaces/search.py — общая логика гибридного поиска по базе знаний.

Раньше код гибрида жил только внутри FastAPI-роута. Теперь его же
используют:
  - GET /api/search  (api/routes/search.py)
  - хук on_message   (palaces/hooks/on_message.py)

Дополнительно здесь — дедуп по topic: чтобы инжект памяти в хуке не
оказался забит 5 узлами одной темы (бывает, когда запрос точно совпадает
с одной подтемой и доминирует и в text-, и в semantic-результате).
"""

import sqlite3

from palaces.db.queries import (
    search_knowledge,
    get_all_node_embeddings,
    get_nodes_by_ids,
)
from palaces.nim.embeddings import embed_text, unpack_vector, cosine


# Веса слагаемых score-а гибрида. Сумма = 1.0.
# Текст весит чуть больше, потому что точное совпадение по ключевому слову
# обычно сильнее, чем «близко по смыслу» — оба сигнала полезны, но точный
# матч редко бывает шумным.
TEXT_WEIGHT = 0.55
SEMANTIC_WEIGHT = 0.45


def hybrid_search(
    conn: sqlite3.Connection,
    query: str,
    limit: int = 10,
    topic_ids: list[int] | None = None,
) -> list[dict]:
    """
    Гибридный поиск: складывает нормированные score текстового и
    семантического поиска. Возвращает узлы, отсортированные по убыванию
    итогового score; каждый узел дополнен полем `score`.

    Если эмбеддинг запроса получить не удалось (нет ключа или сетевая
    ошибка) — graceful degradation до чисто текстового поиска.
    """
    if not query or not query.strip():
        return []

    text_results = search_knowledge(
        conn, query, limit=limit * 2, order="relevance", topic_ids=topic_ids
    )

    sem_scored: list[tuple[int, float]] = []
    qvec = embed_text(query)
    if qvec:
        for nid, blob in get_all_node_embeddings(conn):
            v = unpack_vector(blob)
            if v is not None:
                sem_scored.append((nid, cosine(qvec, v)))
        sem_scored.sort(key=lambda x: x[1], reverse=True)
        sem_scored = sem_scored[: limit * 2]

    if not text_results and not sem_scored:
        return []

    text_max = max((r.get("score") or 0 for r in text_results), default=1) or 1
    sem_max = max((s for _, s in sem_scored), default=1.0) or 1.0

    combined: dict[int, float] = {}
    for r in text_results:
        combined[r["id"]] = combined.get(r["id"], 0.0) + TEXT_WEIGHT * (
            (r.get("score") or 0) / text_max
        )
    for nid, s in sem_scored:
        combined[nid] = combined.get(nid, 0.0) + SEMANTIC_WEIGHT * (s / sem_max)

    ranked_ids = [
        nid for nid, _ in sorted(combined.items(), key=lambda x: x[1], reverse=True)
    ][: limit * 2]

    nodes = get_nodes_by_ids(conn, ranked_ids)
    for n in nodes:
        n["score"] = round(combined.get(n["id"], 0.0), 4)
    if topic_ids:
        nodes = [n for n in nodes if n.get("topic_id") in topic_ids]
    return nodes[:limit]


def dedupe_by_topic(
    nodes: list[dict],
    limit: int,
    max_per_topic: int = 2,
) -> list[dict]:
    """
    Ограничивает количество узлов одной темы в выдаче.

    Зачем: при инжекте в хук on_message хочется разнообразный контекст —
    5 близких узлов одной подтемы менее полезны, чем 5 разных взглядов на
    запрос. Сохраняет порядок (топ-узлы темы остаются впереди).
    """
    out: list[dict] = []
    counts: dict[str, int] = {}
    for n in nodes:
        topic = n.get("topic", "")
        if counts.get(topic, 0) >= max_per_topic:
            continue
        out.append(n)
        counts[topic] = counts.get(topic, 0) + 1
        if len(out) >= limit:
            break
    return out
