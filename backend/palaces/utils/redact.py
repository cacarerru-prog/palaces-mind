"""
redact.py — маскировка секретов в тексте.

Запускается перед сохранением транскрипта сессии и истории запросов
в SQLite. Цель — не дать токенам, ключам и паролям осесть в базе
(а потом случайно попасть в инжект памяти или экспорт).

Принцип: набор регулярок ищет известные паттерны секретов и заменяет
тело на «***REDACTED:тип***», сохраняя осмысленность контекста.

Если паттерн пропустил что-то — это не катастрофа: маскировка лучшее
усилие, а не гарантия. База в любом случае локальная и под токеном
API_TOKEN, наружу не торчит.
"""

import re

# Каждое правило — (имя, скомпилированная регулярка).
# Регулярки упорядочены от более специфичных к общим, чтобы конкретные
# паттерны (AWS, Slack) не съедались общим «длинный токен».
_PATTERNS: list[tuple[str, re.Pattern]] = [
    # Google AI / Gemini API ключи: AIza + 35 символов.
    ("google",  re.compile(r"AIza[0-9A-Za-z_\-]{35}")),
    # OpenAI: sk-... (включая sk-proj-, sk-ant- и т.п.) с длинным телом.
    ("openai",  re.compile(r"sk-[A-Za-z0-9_\-]{20,}")),
    # Anthropic claude: sk-ant- уже покрывается выше, но добавим явно.
    ("anthropic", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    # GitHub: gho_, ghp_, ghs_, ghr_, github_pat_.
    ("github",  re.compile(r"gh[opsu]_[A-Za-z0-9]{30,}")),
    ("github_pat", re.compile(r"github_pat_[A-Za-z0-9_]{20,}")),
    # GitLab personal access tokens.
    ("gitlab",  re.compile(r"glpat-[A-Za-z0-9_\-]{20,}")),
    # Slack: xoxb-, xoxa-, xoxp-, xoxs-, xoxr-.
    ("slack",   re.compile(r"xox[abprs]-[A-Za-z0-9\-]{10,}")),
    # AWS Access Key ID.
    ("aws_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    # NVIDIA NIM: nvapi-...
    ("nvidia",  re.compile(r"nvapi-[A-Za-z0-9_\-]{20,}")),
    # JWT: три base64-куска, разделённых точками.
    ("jwt",     re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b")),
    # PEM-блоки приватных ключей — заменяем весь блок целиком.
    ("private_key", re.compile(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
    )),
    # password=..., password: ..., pwd=..., secret=..., token=...
    # Захватываем имя и значение, маскируем только значение.
    ("kv_secret", re.compile(
        r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|token)\s*[:=]\s*['\"]?([^'\"\s,;]{6,})",
    )),
]

# Минимальная длина «общего» подозрительного токена. Меньше — слишком
# много ложных срабатываний на обычные хеши коммитов и т.п.
GENERIC_TOKEN_MIN = 40

# Общий «длинный непрерывный токен» — последний резерв.
_GENERIC = re.compile(r"\b[A-Za-z0-9+/_\-]{" + str(GENERIC_TOKEN_MIN) + r",}\b")


def redact(text: str) -> str:
    """
    Возвращает текст, в котором известные секреты заменены маркерами.

    Безопасно работает с пустыми и не-строковыми значениями — вернёт
    исходное значение, ничего не ломая.
    """
    if not isinstance(text, str) or not text:
        return text

    out = text
    for name, rx in _PATTERNS:
        if name == "kv_secret":
            # Сохраняем имя ключа, маскируем значение.
            out = rx.sub(lambda m: f"{m.group(1)}=***REDACTED:{name}***", out)
        else:
            out = rx.sub(f"***REDACTED:{name}***", out)

    # Финальная сетка — длинные «строки-однотонные-символы», похожие на токен.
    # Не трогаем содержимое, которое мы уже заменили (там стоит REDACTED).
    def _generic_sub(match: re.Match) -> str:
        chunk = match.group(0)
        if "REDACTED" in chunk:
            return chunk
        # Эвристика: токен должен содержать и буквы, и цифры — иначе это,
        # скорее всего, обычное слово или строка дефисов.
        if not (re.search(r"[A-Za-z]", chunk) and re.search(r"\d", chunk)):
            return chunk
        return "***REDACTED:token***"

    out = _GENERIC.sub(_generic_sub, out)
    return out
