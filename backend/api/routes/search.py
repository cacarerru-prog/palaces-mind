"""
search.py — поиск по базе знаний.

GET /api/search?q=текст&limit=20&order=relevance&topics=1,3&mode=hybrid&rerank=0
    q        — запрос (обязательный)
    limit    — сколько результатов вернуть (макс)
    order    — для текстового режима: relevance | newest | oldest | updated | topic
    topics   — список id тем через запятую (опционально)
    mode     — text   : текстовый поиск (LIKE по словам)
               semantic: семантический поиск (косинус эмбеддингов)
               hybrid  : смешанный (по умолчанию) — складывает оба score
    rerank   — 1/true: после гибрида/семантики прогнать топ-кандидатов
               через LLM-реранкер (find_relevant_memory). Дороже на один
               запрос к LLM, но финальный порядок точнее.

POST /api/embeddings/backfill?batch=50
    Достраивает эмбеддинги для узлов без них (для смыслового поиска
    в старых записях). Запускается из интерфейса кнопкой.

POST /api/embeddings/reset
    Стирает все эмбеддинги (embedding = NULL). Нужно при смене модели
    или размерности вектора — после reset запустить backfill заново.
"""

from fastapi import APIRouter

from config import DB_PATH, MAX_SEARCH_RESULTS
from palaces.db.schema import connect
from palaces.db.queries import (
    search_knowledge,
    get_all_node_embeddings,
    get_nodes_by_ids,
    reset_all_embeddings,
)
from palaces.nim.embeddings import (
    embed_text,
    unpack_vector,
    cosine,
)
from palaces.nim.client import find_relevant_memory
from palaces.structuring import backfill_embeddings

router = APIRouter(prefix="/api")


def _truthy(value) -> bool:
    """Превращает строку из query string в bool: '1','true','yes','on' -> True."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


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


def _semantic_top_ids(query: str, limit: int) -> list[tuple[int, float]]:
    """
    Возвращает топ узлов по косинусной близости к эмбеддингу запроса.

    Список пар (node_id, score). Если ключ LLM не задан или эмбеддингов
    в базе нет — вернёт пустой список.
    """
    qvec = embed_text(query)
    if not qvec:
        return []

    conn = connect(DB_PATH)
    try:
        pairs = get_all_node_embeddings(conn)
    finally:
        conn.close()

    if not pairs:
        return []

    scored: list[tuple[int, float]] = []
    for node_id, blob in pairs:
        vec = unpack_vector(blob)
        if vec is None:
            continue
        scored.append((node_id, cosine(qvec, vec)))
    # Сортируем по убыванию близости и берём верх.
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


@router.get("/search")
def search(
    q: str = "",
    limit: int = MAX_SEARCH_RESULTS,
    order: str = "relevance",
    topics: str | None = None,
    mode: str = "hybrid",
    rerank: str | None = None,
) -> dict:
    """
    Поиск с тремя режимами: text / semantic / hybrid.

    hybrid складывает score текстового и смыслового совпадения, так что
    точные совпадения слов и близкие по смыслу записи появляются вместе.
    """
    if not q.strip():
        return {"query": q, "results": [], "mode": mode}

    topic_ids = _parse_topics(topics)
    do_rerank = _truthy(rerank)

    # ── Чистый текстовый режим ──
    if mode == "text":
        conn = connect(DB_PATH)
        try:
            results = search_knowledge(
                conn, q, limit=limit, order=order, topic_ids=topic_ids
            )
        finally:
            conn.close()
        if do_rerank and order == "relevance":
            results = find_relevant_memory(q, results)
        return {"query": q, "results": results, "mode": "text", "reranked": do_rerank}

    # ── Семантический режим ──
    if mode == "semantic":
        scored = _semantic_top_ids(q, limit * 3)
        if not scored:
            return {"query": q, "results": [], "mode": "semantic", "note": "embeddings_empty"}
        conn = connect(DB_PATH)
        try:
            # Фильтр по темам делаем после загрузки — для простоты.
            nodes = get_nodes_by_ids(conn, [nid for nid, _ in scored])
        finally:
            conn.close()
        score_map = {nid: s for nid, s in scored}
        for n in nodes:
            n["score"] = round(score_map.get(n["id"], 0.0), 4)
        if topic_ids:
            nodes = [n for n in nodes if n.get("topic_id") in topic_ids]
        nodes = nodes[:limit]
        if do_rerank:
            nodes = find_relevant_memory(q, nodes)
        return {"query": q, "results": nodes, "mode": "semantic", "reranked": do_rerank}

    # ── Гибридный режим (по умолчанию) ──
    # Берём текстовые попадания + семантические, складываем score.
    conn = connect(DB_PATH)
    try:
        text_results = search_knowledge(
            conn, q, limit=limit * 2, order="relevance", topic_ids=topic_ids
        )
    finally:
        conn.close()

    sem_scored = _semantic_top_ids(q, limit * 2)
    if not text_results and not sem_scored:
        return {"query": q, "results": [], "mode": "hybrid"}

    # Объединяем по id; нормализуем оба score к диапазону 0..1.
    text_max = max((r.get("score") or 0 for r in text_results), default=1) or 1
    sem_max  = max((s for _, s in sem_scored), default=1.0) or 1.0

    combined: dict[int, float] = {}
    for r in text_results:
        combined[r["id"]] = combined.get(r["id"], 0.0) + 0.55 * ((r.get("score") or 0) / text_max)
    for nid, s in sem_scored:
        combined[nid] = combined.get(nid, 0.0) + 0.45 * (s / sem_max)

    # Сортируем по итоговому score, берём top-limit.
    ranked_ids = [
        nid for nid, _ in sorted(combined.items(), key=lambda x: x[1], reverse=True)
    ][:limit]

    conn = connect(DB_PATH)
    try:
        nodes = get_nodes_by_ids(conn, ranked_ids)
    finally:
        conn.close()
    for n in nodes:
        n["score"] = round(combined.get(n["id"], 0.0), 4)
    if topic_ids:
        nodes = [n for n in nodes if n.get("topic_id") in topic_ids]
    if do_rerank:
        nodes = find_relevant_memory(q, nodes)
    return {"query": q, "results": nodes, "mode": "hybrid", "reranked": do_rerank}


@router.post("/embeddings/backfill")
def embeddings_backfill(batch: int = 25) -> dict:
    """Достраивает эмбеддинги для узлов, у которых их ещё нет."""
    done = backfill_embeddings(batch_size=batch)
    return {"status": "ok", "embedded": done}


@router.post("/embeddings/reset")
def embeddings_reset() -> dict:
    """
    Стирает все эмбеддинги (UPDATE ... SET embedding = NULL).

    Нужно после смены embedding-модели или размерности — старые векторы
    несовместимы по смыслу с новыми. После reset запустить /api/embeddings/backfill
    (возможно, несколько раз с batch=50, пока embedded не станет 0).
    """
    conn = connect(DB_PATH)
    try:
        cleared = reset_all_embeddings(conn)
    finally:
        conn.close()
    return {"status": "ok", "cleared": cleared}
