"""
logger.py — единая настройка логирования для всего проекта.

Любой модуль вызывает get_logger("имя") и получает готовый логгер,
который пишет и в файл logs/palaces.log, и в консоль.
"""

import logging
import sys

# Импортируем путь к папке логов из центрального конфига.
from config import LOGS_DIR

# Файл, куда складываются все записи.
LOG_FILE = LOGS_DIR / "palaces.log"

# Формат строки лога:
# 2026-05-19 10:30:00 | INFO | on_message | Найдено 3 записи для "docker"
LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logger(name: str) -> logging.Logger:
    """
    Возвращает настроенный логгер с заданным именем.

    name — обычно имя модуля ("on_message", "nim", "api"),
    оно попадает в каждую строку лога, чтобы было видно источник.
    """
    logger = logging.getLogger(name)

    # Если у логгера уже есть обработчики — значит он уже настроен.
    # Выходим, чтобы не добавить их повторно (иначе строки задвоятся).
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Обработчик 1 — запись в файл (кодировка utf-8 для русского текста).
    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Обработчик 2 — вывод в stderr.
    # Важно: хуки общаются с Claude Code через stdout, поэтому логи
    # пишем в stderr, чтобы случайно не сломать ответ хука.
    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    return logger
