"""
check_search.py — быстрый sanity-check семантического поиска по базе.

Запуск из backend/:
    python -m scripts.check_search
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from palaces.db.schema import connect
from palaces.db.queries import get_all_node_embeddings, get_nodes_by_ids
from palaces.nim.embeddings import embed_text, unpack_vector, cosine
from config import DB_PATH


QUERIES = [
    "как делать оценку историй в скраме",
    "управление рисками проекта",
    "OKR постановка целей",
    "конфликт в команде",
    "что мерить в kanban",
]


def main() -> None:
    conn = connect(DB_PATH)
    pairs = get_all_node_embeddings(conn)
    print(f"Узлов с эмбеддингами: {len(pairs)}\n")

    for q in QUERIES:
        qvec = embed_text(q)
        if not qvec:
            print(f"!! не получили эмбеддинг для {q!r}")
            continue
        scored = []
        for nid, blob in pairs:
            v = unpack_vector(blob)
            if v:
                scored.append((nid, cosine(qvec, v)))
        scored.sort(key=lambda x: x[1], reverse=True)
        top = scored[:3]
        top_ids = [nid for nid, _ in top]
        nodes = get_nodes_by_ids(conn, top_ids)
        score_by_id = dict(top)

        print(f"== {q!r} ==")
        for n in nodes:
            sc = score_by_id.get(n["id"], 0.0)
            line = f"  [{sc:.3f}] {n['topic']}/{n['subtopic']} :: {n['summary'][:90]}"
            print(line)
        print()
    conn.close()


if __name__ == "__main__":
    main()
