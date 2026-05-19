"""
main.py — точка входа FastAPI-сервера.

Запуск:  cd D:\\mind\\palaces-of-the-mind\\backend
         python -m api.main

Сервер поднимается на http://127.0.0.1:8765 и обслуживает
запросы от Electron-интерфейса.

При старте:
  1. Создаёт/проверяет базу SQLite (init_db).
  2. Подключает группы роутов (search, memory, stats).
  3. Включает CORS, чтобы окно Electron могло обращаться к API.
"""

import threading
import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import (
    API_HOST,
    API_PORT,
    API_TOKEN,
    DB_PATH,
    SESSION_IDLE_MINUTES,
    SWEEP_INTERVAL_SECONDS,
    SWEEP_MAX_PER_RUN,
)
from palaces.db.schema import init_db
from palaces.structuring import process_stale_sessions
from palaces.utils.logger import get_logger
from api.routes import search, memory, stats

log = get_logger("api")


def _sweeper_loop() -> None:
    """
    Фоновый «уборщик»: периодически разбирает затихшие сессии через LLM.

    Крутится в отдельном потоке всё время, пока работает сервер.
    Один цикл: найти затихшие необработанные сессии -> разобрать ->
    подождать SWEEP_INTERVAL_SECONDS -> повторить.
    """
    while True:
        try:
            count = process_stale_sessions(SESSION_IDLE_MINUTES, SWEEP_MAX_PER_RUN)
            if count:
                log.info("Уборщик: разобрано сессий — %d", count)
        except Exception as e:
            log.error("Сбой уборщика сессий: %s", e)
        time.sleep(SWEEP_INTERVAL_SECONDS)

# Создаём приложение FastAPI.
app = FastAPI(title="Palaces of the Mind API", version="1.0.0")

# CORS: разрешаем запросы ТОЛЬКО от окна Electron.
#   - http://localhost:5173 — режим разработки (dev-сервер Vite);
#   - "null" — собранное приложение грузит страницу через file://,
#     браузер в этом случае шлёт Origin: null.
# Звёздочку "*" использовать нельзя: иначе любой открытый в браузере
# сайт смог бы из JavaScript читать и удалять твою базу знаний.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "null"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_token(request: Request, call_next):
    """
    Проверяет секретный токен на запросах к API.

    Если API_TOKEN задан (сервер запущен из приложения Electron) — каждый
    запрос к /api/* обязан прислать верный заголовок X-Palaces-Token.
    Исключения: служебный /api/health и предварительные запросы OPTIONS
    (в них браузер не шлёт пользовательские заголовки — иначе сломается CORS).
    Если токен пустой (ручной запуск сервера) — проверка пропускается.
    """
    path = request.url.path
    if (
        API_TOKEN
        and request.method != "OPTIONS"
        and path.startswith("/api/")
        and path != "/api/health"
    ):
        if request.headers.get("X-Palaces-Token") != API_TOKEN:
            return JSONResponse(
                {"detail": "Неверный или отсутствующий токен доступа"},
                status_code=401,
            )
    return await call_next(request)


# Подключаем три группы роутов. У каждого роутера префикс /api внутри файла.
app.include_router(search.router)
app.include_router(memory.router)
app.include_router(stats.router)


@app.on_event("startup")
def on_startup() -> None:
    """Выполняется один раз при старте сервера: база + фоновый разбор."""
    init_db(DB_PATH)
    # Запускаем уборщика в отдельном потоке. daemon=True значит, что
    # поток автоматически завершится вместе с сервером.
    threading.Thread(target=_sweeper_loop, daemon=True).start()
    log.info("Сервер запущен, база готова, фоновый разбор сессий включён")


@app.get("/api/health")
def health() -> dict:
    """Простой эндпоинт проверки, что сервер жив."""
    return {"status": "ok"}


if __name__ == "__main__":
    # Запуск встроенного веб-сервера uvicorn.
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="info")
