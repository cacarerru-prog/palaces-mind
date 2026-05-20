# PyInstaller spec для сборки palaces-server.exe
#
# Запуск:  cd D:\mind\palaces-of-the-mind\backend
#          pyinstaller palaces-server.spec
#
# Результат: backend\dist\palaces-server.exe — автономный сервер FastAPI
# без необходимости иметь Python в системе.

# -*- mode: python ; coding: utf-8 -*-

BACKEND_DIR = r'D:\mind\palaces-of-the-mind\backend'

a = Analysis(
    ['server.py'],
    pathex=[BACKEND_DIR],
    binaries=[],
    datas=[],
    # uvicorn и fastapi внутри подгружают модули динамически —
    # PyInstaller не видит эти импорты статически, поэтому перечисляем.
    hiddenimports=[
        # uvicorn loops
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        # uvicorn protocols
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.protocols.websockets.websockets_impl',
        # uvicorn lifespan
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        # uvicorn logging
        'uvicorn.logging',
        # наши собственные модули — на всякий, чтобы PyInstaller точно вшил
        'api.main',
        'api.routes.search',
        'api.routes.memory',
        'api.routes.stats',
        'palaces.db.schema',
        'palaces.db.queries',
        'palaces.nim.client',
        'palaces.nim.embeddings',
        'palaces.utils.logger',
        'palaces.utils.redact',
        'palaces.structuring',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='palaces-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # не сжимаем UPX — антивирусы часто пугаются
    upx_exclude=[],
    runtime_tmpdir=None,
    # console=True — оставляем консоль для вывода логов uvicorn.
    # Electron при спавне ставит windowsHide=true, и окно консоли скрывается.
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
