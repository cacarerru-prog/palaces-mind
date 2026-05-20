"""
server.py — точка входа для автономной сборки сервера через PyInstaller.

Когда сервер пакуется в `palaces-server.exe`, обычный `python -m api.main`
уже не работает — нет интерпретатора. Этот файл является самостоятельным
скриптом запуска: PyInstaller превращает его в один .exe со всеми
зависимостями (fastapi, uvicorn, openai, sqlite3 и т.д.).

В dev-режиме Electron всё ещё запускает Python напрямую (`python -m api.main`).
В упакованном виде Electron запускает уже `palaces-server.exe`.
"""

import os
import sys

# Добавляем папку backend в sys.path: внутри .exe PyInstaller разворачивает
# исходники во временную папку, и относительные импорты сами не находятся.
# В dev-режиме __file__ указывает на backend/server.py — добавляем эту же папку.
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Импортируем после правки sys.path — иначе config.py не найдётся в .exe.
import uvicorn
from api.main import app
from config import API_HOST, API_PORT


def main() -> None:
    """Запускает FastAPI на 127.0.0.1:8765."""
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="info")


if __name__ == "__main__":
    main()
