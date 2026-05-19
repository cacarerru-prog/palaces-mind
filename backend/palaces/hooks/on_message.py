#!/usr/bin/env python3
"""
on_message.py — хук события UserPromptSubmit.

ВАЖНО про событие: в Claude Code НЕТ события "UserMessage".
Реальное событие, которое срабатывает при отправке сообщения
пользователем — это "UserPromptSubmit". Его и обрабатываем.

Что делает хук:
  1. Читает JSON из stdin (там поле "prompt" — текст запроса).
  2. Ищет в SQLite релевантные записи памяти (быстрый текстовый поиск).
  3. Если что-то нашёл — отдаёт это Claude Code как доп. контекст.
  4. Логирует запрос в историю.

Формат ответа для UserPromptSubmit (печатается в stdout):
  {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
                          "additionalContext": "...текст..."}}
Если памяти нет — просто ничего не печатаем и выходим с кодом 0.

Золотое правило: хук НИКОГДА не падает с ошибкой. Любое исключение
ловим, пишем в лог, выходим с кодом 0 — чтобы не мешать Claude Code.
"""

import json
import sys

# На Windows stdin/stdout/stderr по умолчанию в системной кодировке (cp1251),
# которая не умеет эмодзи и часть символов. Принудительно ставим UTF-8 —
# иначе print() с эмодзи 🧠 уронит хук с UnicodeEncodeError.
for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Хук запускается Claude Code из произвольной директории, поэтому
# Python сам не найдёт наши модули. Добавляем папку backend в путь поиска.
sys.path.insert(0, "D:/mind/palaces-of-the-mind/backend")

from config import DB_PATH, MAX_SEARCH_RESULTS
from palaces.db.schema import connect, init_db
from palaces.db.queries import search_knowledge, save_query
from palaces.utils.logger import get_logger

log = get_logger("on_message")


def build_context(results: list[dict]) -> str:
    """Собирает найденные записи в текстовый блок для Claude."""
    lines = ["## 🧠 Из твоей памяти (Palaces of the Mind):", ""]
    for r in results:
        lines.append(f"**{r['topic']} → {r['subtopic']}**")
        lines.append(r["summary"])
        lines.append("")
    return "\n".join(lines).strip()


def main() -> None:
    # 1. Читаем и разбираем JSON, который Claude Code прислал в stdin.
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}

    prompt = data.get("prompt", "")
    session_id = data.get("session_id")

    if not prompt.strip():
        return  # пустой запрос — нечего искать

    # На случай, если сервер ещё ни разу не запускался — создаём базу.
    init_db(DB_PATH)

    # 2. Ищем релевантные записи в базе.
    conn = connect(DB_PATH)
    try:
        results = search_knowledge(conn, prompt, limit=MAX_SEARCH_RESULTS)
        # 4. Логируем запрос в историю (даже если ничего не нашли).
        save_query(conn, prompt, results, session_id)
    finally:
        conn.close()

    if not results:
        log.info('Память пуста для запроса: "%s"', prompt[:60])
        return  # ничего не печатаем — доп. контекста не будет

    # 3. Отдаём найденное Claude Code в правильном формате.
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": build_context(results),
        }
    }
    log.info('Найдено %d записей для запроса: "%s"', len(results), prompt[:60])
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Любая ошибка не должна сломать Claude Code — гасим её тихо.
        try:
            get_logger("on_message").error("Сбой хука on_message: %s", e)
        except Exception:
            pass
    # Всегда выходим с кодом 0 — успех с точки зрения Claude Code.
    sys.exit(0)
