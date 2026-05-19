#!/usr/bin/env python3
"""
on_stop.py — хук события Stop.

Срабатывает каждый раз, когда ассистент закончил ответ. Задача хука —
максимально дёшево и быстро сохранить текущее состояние сессии в SQLite.
Обращений к LLM здесь НЕТ — поэтому хук отрабатывает за миллисекунды.

Разбор сессии на знания делает фоновый «уборщик» внутри FastAPI-сервера
(см. palaces/structuring.py): он берёт сессию и разбирает её один раз,
когда она «затихла». Так один диалог = один запрос к LLM, а не запрос
на каждый ход — это бережёт бесплатный лимит.

ВАЖНО про формат: Stop передаёт не сам транскрипт, а transcript_path —
путь к .jsonl файлу, который нужно прочитать самим.
"""

import json
import os
import sys

# На Windows stdin/stdout/stderr по умолчанию в системной кодировке (cp1251).
# Принудительно ставим UTF-8, чтобы вывод и логи не падали на эмодзи/спецсимволах.
for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, "D:/mind/palaces-of-the-mind/backend")

from config import DB_PATH
from palaces.db.schema import connect, init_db
from palaces.db.queries import save_session
from palaces.utils.logger import get_logger

log = get_logger("on_stop")


# ─── Чтение транскрипта ─────────────────────────────────────────────────────

def read_transcript(path: str) -> str:
    """
    Читает файл транскрипта .jsonl и собирает из него один текст.

    Каждая строка файла — отдельный JSON-объект сообщения. У сообщения
    есть роль (user/assistant) и содержимое (строка или список блоков).
    """
    if not path or not os.path.isfile(path):
        return ""

    parts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Реальное сообщение лежит во вложенном поле "message".
            message = obj.get("message", obj)
            role = message.get("role")
            if role not in ("user", "assistant"):
                continue

            text = _content_to_text(message.get("content", ""))
            if text.strip():
                parts.append(f"{role}: {text}")

    return "\n\n".join(parts)


def _content_to_text(content) -> str:
    """
    Превращает поле content в обычный текст.

    content бывает строкой ("привет") или списком блоков
    ([{"type": "text", "text": "..."}, ...]) — обрабатываем оба случая.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                chunks.append(block.get("text", ""))
        return " ".join(chunks)
    return ""


# ─── Обработка события Stop ─────────────────────────────────────────────────

def run_hook() -> None:
    """Принимает событие Stop и дёшево сохраняет сессию в SQLite."""
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}

    session_id = data.get("session_id")
    transcript_path = data.get("transcript_path")

    if not session_id:
        return

    text = read_transcript(transcript_path)
    if not text.strip():
        log.info("Транскрипт пуст, сессия %s пропущена", session_id)
        return

    # На случай, если сервер ещё ни разу не запускался — создаём базу.
    init_db(DB_PATH)

    # Сохраняем (или обновляем) сессию. Это быстрая запись в SQLite —
    # LLM здесь не вызывается. Разбор сделает фоновый уборщик сервера.
    conn = connect(DB_PATH)
    try:
        save_session(conn, session_id, text)
    finally:
        conn.close()

    log.info("Сессия %s сохранена (разбор сделает сервер позже)", session_id)


def main() -> None:
    run_hook()
    # Stop-хук обязан вернуть валидный JSON-ответ — отдаём пустой объект.
    print("{}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Любая ошибка не должна сломать Claude Code — гасим её тихо
        # и всё равно отдаём корректный ответ.
        try:
            get_logger("on_stop").error("Сбой хука on_stop: %s", e)
        except Exception:
            pass
        print("{}")
    sys.exit(0)
