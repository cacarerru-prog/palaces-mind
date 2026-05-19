"""
client.py — клиент LLM API (по умолчанию Google Gemini).

API совместим с OpenAI SDK, поэтому используем библиотеку openai,
просто подменяя адрес сервера и модель (всё настраивается в config.py).

Здесь две задачи:
  1. parse_and_structure() — разобрать текст сессии на узлы знаний;
  2. find_relevant_memory() — отранжировать кандидатов по релевантности.

Главное правило модуля: при ЛЮБОЙ ошибке — записать в лог и вернуть
пустой результат. Падать нельзя, иначе сломается хук Claude Code.
"""

import json

from config import (
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
    LLM_TIMEOUT,
    is_llm_key_set,
)
from palaces.utils.logger import get_logger

log = get_logger("llm")

# Системный промпт для разбора сессии на структурированные знания.
SYSTEM_PROMPT_STRUCTURE = """Ты — система структурирования знаний программиста.
Тебе дают текст диалога между разработчиком и AI-ассистентом.
Извлеки из текста ВСЕ технические знания, решения и паттерны.

Верни JSON-массив объектов. Каждый объект:
{
  "topic": "главная тема (язык/технология/концепция)",
  "subtopic": "конкретная подтема",
  "summary": "суть в 1-2 предложениях",
  "detail": "подробное объяснение для будущего использования",
  "keywords": ["ключевое_слово_1", "ключевое_слово_2"]
}

Правила:
- Только технические знания, без воды
- topic должен быть коротким: "Go", "Docker", "SQL", "Git"
- keywords — на английском, lowercase
- Если знаний нет — верни пустой массив []
- Отвечай ТОЛЬКО валидным JSON, без пояснений"""

# Системный промпт для ранжирования кандидатов по релевантности.
SYSTEM_PROMPT_RANK = """Ты — система оценки релевантности.
Тебе дают запрос пользователя и пронумерованный список записей памяти.
Верни JSON-массив номеров записей, отсортированный по убыванию
релевантности запросу. Включай только реально подходящие записи.
Отвечай ТОЛЬКО валидным JSON-массивом чисел, например: [2, 0, 1]"""


def _get_client():
    """
    Создаёт клиент OpenAI SDK, настроенный на адрес LLM-провайдера.

    Импорт openai делается здесь, а не вверху файла, специально:
    если библиотека не установлена, ошибка не помешает импортировать
    этот модуль (важно для хуков, которые не должны падать).
    """
    from openai import OpenAI  # локальный импорт — см. комментарий выше

    return OpenAI(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        timeout=LLM_TIMEOUT,
    )


def _extract_json(text: str):
    """
    Достаёт JSON из ответа модели.

    Модель иногда оборачивает JSON в ```json ... ``` или добавляет
    текст вокруг. Берём подстроку от первой скобки до последней.
    """
    text = text.strip()
    # Ищем массив [...] — оба наших промпта просят именно массив.
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def _chat(system_prompt: str, user_content: str, retried: bool = False) -> str | None:
    """
    Делает один запрос к LLM. Возвращает текст ответа или None.

    retried — флаг, что это уже повторная попытка (чтобы не зациклиться).
    При сетевой ошибке делаем ровно одну повторную попытку.
    """
    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,  # низкая температура — ответы стабильнее
        )
        return response.choices[0].message.content
    except Exception as e:
        if not retried:
            log.warning("Ошибка запроса к LLM, повтор: %s", e)
            return _chat(system_prompt, user_content, retried=True)
        log.error("Запрос к LLM не удался окончательно: %s", e)
        return None


def parse_and_structure(raw_text: str) -> list[dict]:
    """
    Отправляет текст сессии в LLM и возвращает список узлов знаний.

    Каждый узел — словарь с ключами:
    topic, subtopic, summary, detail, keywords.
    При любой проблеме возвращает пустой список [].
    """
    # Если ключ ещё не вписан — молча выходим.
    if not is_llm_key_set():
        log.info("LLM_API_KEY не задан — разбор сессии пропущен")
        return []

    if not raw_text or not raw_text.strip():
        return []

    answer = _chat(SYSTEM_PROMPT_STRUCTURE, raw_text)
    if answer is None:
        return []

    data = _extract_json(answer)
    if not isinstance(data, list):
        log.warning("LLM вернул не-массив, разбор пропущен")
        return []

    # Оставляем только корректные объекты с обязательными полями.
    result = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if not item.get("topic") or not item.get("summary"):
            continue
        result.append({
            "topic": str(item.get("topic", "")).strip(),
            "subtopic": str(item.get("subtopic", "общее")).strip() or "общее",
            "summary": str(item.get("summary", "")).strip(),
            "detail": str(item.get("detail", "")).strip(),
            "keywords": item.get("keywords", []) if isinstance(item.get("keywords"), list) else [],
        })

    log.info("LLM извлёк %d узлов знаний из сессии", len(result))
    return result


def find_relevant_memory(query: str, candidates: list[dict]) -> list[dict]:
    """
    Ранжирует кандидатов из SQLite по релевантности запросу.

    Если кандидатов меньше 3 или ключ не задан — возвращает список
    как есть, без обращения к LLM (экономим запросы).
    """
    if len(candidates) < 3 or not is_llm_key_set():
        return candidates

    # Формируем пронумерованный список для модели.
    listing = "\n".join(
        f"{i}. [{c.get('topic')}] {c.get('summary')}"
        for i, c in enumerate(candidates)
    )
    user_content = f"Запрос: {query}\n\nЗаписи памяти:\n{listing}"

    answer = _chat(SYSTEM_PROMPT_RANK, user_content)
    if answer is None:
        return candidates

    order = _extract_json(answer)
    if not isinstance(order, list):
        return candidates

    # Переставляем кандидатов по порядку номеров от модели.
    ranked = []
    for idx in order:
        if isinstance(idx, int) and 0 <= idx < len(candidates):
            ranked.append(candidates[idx])

    # Если модель вернула пустоту/мусор — отдаём исходный список.
    return ranked or candidates
