# Промпт для Claude Code — скопируй и вставь целиком

```
Реализуй проект "Palaces of the Mind" согласно CLAUDE.md.

━━━ ПУТИ (всё на диске D:) ━━━

Корень проекта:       D:\mind\palaces-of-the-mind\
Python backend:       D:\mind\palaces-of-the-mind\backend\
Electron frontend:    D:\mind\palaces-of-the-mind\frontend\
SQLite база:          D:\mind\palaces-of-the-mind\data\memory.db
Логи:                 D:\mind\palaces-of-the-mind\logs\palaces.log

Хук on_message:       D:\mind\palaces-of-the-mind\backend\palaces\hooks\on_message.py
Хук on_stop:          D:\mind\palaces-of-the-mind\backend\palaces\hooks\on_stop.py
Конфиг проекта:       D:\mind\palaces-of-the-mind\backend\config.py

Хуки Claude Code:     C:\Users\cacar\.claude\settings.json
(примечание: .claude/ живёт в профиле пользователя на C: — это требование Claude Code,
 но все данные, логи и база хранятся на D:)

━━━ В config.py прописать явно ━━━

BASE_DIR  = Path("D:/mind/palaces-of-the-mind")
DATA_DIR  = Path("D:/mind/palaces-of-the-mind/data")
LOGS_DIR  = Path("D:/mind/palaces-of-the-mind/logs")
DB_PATH   = Path("D:/mind/palaces-of-the-mind/data/memory.db")

Не использовать __file__ для вычисления путей —
прописать абсолютные пути на D: явно.

━━━ В on_message.py и on_stop.py ━━━

Импортировать config так:
  import sys
  sys.path.insert(0, "D:/mind/palaces-of-the-mind/backend")
  from config import DB_PATH, LOGS_DIR

Это нужно потому что хуки вызываются Claude Code из любой директории,
и Python иначе не найдёт модули проекта.

━━━ В Electron (index.js) ━━━

Python процесс запускать так:
  const pythonProcess = spawn("python", ["-m", "api.main"], {
    cwd: "D:\\mind\\palaces-of-the-mind\\backend"
  })

Логи Electron писать в:
  D:\mind\palaces-of-the-mind\logs\electron.log

━━━ NVIDIA NIM ━━━

API ключ:     вставить в D:\mind\palaces-of-the-mind\backend\config.py
              поле NVIDIA_API_KEY = "ВСТАВЬ_СЮДА_СВОЙ_КЛЮЧ"
Base URL:     https://integrate.api.nvidia.com/v1
Модель:       meta/llama-3.1-8b-instruct

━━━ FASTAPI СЕРВЕР ━━━

Host:         127.0.0.1
Port:         8765
Запуск:       cd D:\mind\palaces-of-the-mind\backend && python -m api.main

━━━ ELECTRON ━━━

Dev запуск:   cd D:\mind\palaces-of-the-mind\frontend && npm run dev
Electron грузит в dev:  http://localhost:5173
Electron грузит в prod: D:\mind\palaces-of-the-mind\frontend\dist\index.html

━━━ ХУКИ В .claude\settings.json ━━━

{
  "hooks": {
    "UserMessage": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python D:\\mind\\palaces-of-the-mind\\backend\\palaces\\hooks\\on_message.py"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "python D:\\mind\\palaces-of-the-mind\\backend\\palaces\\hooks\\on_stop.py"
      }]
    }]
  }
}

━━━ ЗАДАНИЕ ━━━

Я начинающий разработчик — комментируй каждый блок кода на русском языке.

Реализуй строго по порядку из CLAUDE.md:

Задача 1 → D:\mind\palaces-of-the-mind\backend\palaces\db\schema.py
            D:\mind\palaces-of-the-mind\backend\palaces\db\queries.py

Задача 2 → D:\mind\palaces-of-the-mind\backend\palaces\nim\client.py

Задача 3 → D:\mind\palaces-of-the-mind\backend\palaces\hooks\on_message.py
            D:\mind\palaces-of-the-mind\backend\palaces\hooks\on_stop.py

Задача 4 → D:\mind\palaces-of-the-mind\backend\api\main.py
            D:\mind\palaces-of-the-mind\backend\api\routes\search.py
            D:\mind\palaces-of-the-mind\backend\api\routes\memory.py
            D:\mind\palaces-of-the-mind\backend\api\routes\stats.py

Задача 5 → D:\mind\palaces-of-the-mind\frontend\src\main\index.js
            D:\mind\palaces-of-the-mind\frontend\src\renderer\App.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\api.js
            D:\mind\palaces-of-the-mind\frontend\src\renderer\pages\Search.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\pages\Knowledge.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\pages\AddNote.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\pages\Stats.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\components\Layout.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\components\TopicCard.jsx
            D:\mind\palaces-of-the-mind\frontend\src\renderer\components\SearchResult.jsx

Задача 6 → C:\Users\cacar\.claude\settings.json

Задача 7 → D:\mind\palaces-of-the-mind\backend\requirements.txt
            D:\mind\palaces-of-the-mind\frontend\package.json
            D:\mind\palaces-of-the-mind\frontend\vite.config.js
            D:\mind\palaces-of-the-mind\frontend\electron-builder.yml
            D:\mind\palaces-of-the-mind\frontend\src\renderer\index.html
            D:\mind\palaces-of-the-mind\frontend\src\renderer\main.jsx
            D:\mind\palaces-of-the-mind\frontend\tailwind.config.js
            D:\mind\palaces-of-the-mind\frontend\postcss.config.js

После каждой задачи: проверь импорты (Python) / синтаксис (JS),
напиши "✅ Задача N готова" и переходи к следующей без остановок.
Не спрашивай уточнений — все детали в CLAUDE.md в корне проекта.
```
