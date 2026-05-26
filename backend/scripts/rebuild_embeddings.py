"""
rebuild_embeddings.py — миграция эмбеддингов под актуальную LLM-модель.

Что делает:
  1) обнуляет колонку embedding у всех узлов (старые векторы от другой
     модели или размерности несовместимы по смыслу с новыми);
  2) циклом вызывает backfill_embeddings(), пока не закончатся узлы
     без эмбеддинга. Между пачками делает пауза, чтобы не упереться
     в rate limit бесплатного тарифа Gemini.

Запуск из backend/:
    python -m scripts.rebuild_embeddings
"""

import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from config import DB_PATH
from palaces.db.schema import connect, init_db
from palaces.db.queries import reset_all_embeddings
from palaces.structuring import backfill_embeddings


# Размер пачки для backfill: чем больше — тем быстрее, но выше шанс упереться
# в rate limit. У бесплатного Gemini ≈ 15 RPM для embeddings.
BATCH_SIZE = 25
# Пауза между пачками — даёт rate limit «выдохнуть».
PAUSE_SECONDS = 5
# Защита от бесконечного цикла, если backfill постоянно возвращает 0.
MAX_BATCHES = 100


def main() -> None:
    init_db(DB_PATH)

    conn = connect(DB_PATH)
    try:
        cleared = reset_all_embeddings(conn)
    finally:
        conn.close()
    print(f"Сброшено старых эмбеддингов: {cleared}")

    total = 0
    for i in range(MAX_BATCHES):
        done = backfill_embeddings(batch_size=BATCH_SIZE)
        total += done
        print(f"  пачка {i + 1}: построено {done} (итого {total})")
        if done == 0:
            break
        time.sleep(PAUSE_SECONDS)

    print(f"Готово: всего построено эмбеддингов {total}")


if __name__ == "__main__":
    main()
