#!/usr/bin/env python3
"""
run_ui.py — единый лаунчер проекта BONDINVEST.

Логика работы:
 1. Проверяет наличие Node.js и npm (нужны для сборки фронтенда на Vite).
 2. Если node_modules отсутствует или устарел относительно package-lock.json —
    выполняет `npm install` автоматически.
 3. Опционально запускает Python API математической модели (BONDINVEST/model/api.py)
    на порту 8000 в фоновом процессе (--with-model флаг).
 4. Запускает dev-сервер Vite (`npm run dev`) в отдельном процессе.
 5. Ждёт готовности http://localhost:5173 и открывает страницу в браузере
    пользователя (webbrowser.open — использует системный браузер по умолчанию).
 6. По Ctrl+C корректно завершает дочерние процессы.

Запуск с любой машины/папки:
    python3 BONDINVEST/run_ui.py              # только фронтенд
    python3 BONDINVEST/run_ui.py --with-model # фронтенд + API модели на :8000
    python3 BONDINVEST/run_ui.py --port 3000  # указать порт Vite
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser

# --- Пути проекта: вычисляются относительно самого скрипта, ---------------
# поэтому запуск из любой рабочей директории работает одинаково.
ROOT = os.path.dirname(os.path.abspath(__file__))          # .../BONDINVEST
APP_DIR = os.path.join(ROOT, "app")                        # фронтенд (Vite+React)
MODEL_DIR = os.path.join(ROOT, "model")                    # python-модель выплат
FRONTEND_URL_DEFAULT = "http://localhost:5173"


def die(msg: str) -> None:
    """Печатает ошибку и завершает процесс с ненулевым кодом."""
    print(f"[BONDINVEST] ОШИБКА: {msg}", file=sys.stderr)
    sys.exit(1)


def _npm_candidates() -> list[str]:
    """
    Список имён npm-исполняемого в порядке проверки.

    Логика: на Windows npm поставляется как several shim-файлы в одной папке
    с node.exe: `npm.cmd` (классический cmd-шим) и `npm.exe` (shim для Git Bash).
    Просто `"npm"` резолвится только если расширение есть в PATHEXT; при его
    отсутствии shutil.which("npm") возвращает None и subprocess падает с
    FileNotFoundError [WinError 2] — что и наблюдалось у пользователя.
    Поэтому перебираем все реальные варианты, а не одно имя.
    """
    names = ["npm"]
    if os.name == "nt":
        names += ["npm.cmd", "npm.exe"]
    return names


def resolve_npm() -> str:
    """Возвращает полный путь к первому найденному npm-исполняемому."""
    for name in _npm_candidates():
        found = shutil.which(name)          # which учитывает PATHEXT на Windows
        if found:
            return found                     # полный путь снимает зависимость от PATH внутри Popen
    die(
        "npm не найден в PATH. Установите Node.js 18+ (https://nodejs.org)\n"
        "            и перезапустите терминал, чтобы PATH обновился."
    )


def check_node() -> None:
    """Убеждаемся, что Node.js доступен в PATH (npm проверим отдельно)."""
    if shutil.which("node") is None:
        die("node не найден в PATH. Установите Node.js 18+ (https://nodejs.org).")


def run_npm(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    """
    Единая точка запуска npm с защитой от Windows-специфики.

    Логика: даже если shutil.which нашёл `npm.cmd`, запуск cmd-шимов через
    subprocess без shell=True на некоторых конфигурациях Windows (ограничения
    политики, нестандартные PATH) даёт FileNotFoundError [WinError 2].
    Решение: shell=True позволяет Windows самому резолвить .cmd/.exe по PATHEXT;
    аргументы передаются списком — Python корректно экранирует их перед
    конкатенацией в командную строку. На POSIX shell=True безвреден.
    kw пробрасывается дальше (например, cwd=APP_DIR).
    """
    full = [npm_path()] + cmd
    if os.name == "nt":
        return subprocess.run(full, shell=True, **kw)
    return subprocess.run(full, **kw)


def npm_path() -> str:
    """Кэшированный результат resolve_npm() (ищем один раз за запуск)."""
    global _NPM_PATH
    if "_NPM_PATH" not in globals():
        _NPM_PATH = resolve_npm()
    return _NPM_PATH


def ensure_dependencies(npm_cmd: str) -> None:
    """
    Установка npm-зависимостей при необходимости.

    Критерий «устарел»: package-lock.json новее папки node_modules —
    значит, манифест менялся и локальные пакеты могут не совпадать.
    """
    modules = os.path.join(APP_DIR, "node_modules")
    lock = os.path.join(APP_DIR, "package-lock.json")
    need_install = not os.path.isdir(modules)
    if not need_install and os.path.isfile(lock):
        need_install = os.path.getmtime(lock) > os.path.getmtime(modules)
    if need_install:
        print(f"[BONDINVEST] Устанавливаю npm-зависимости ({npm_cmd} install)…")
        run_npm(["install"], cwd=APP_DIR, check=True)
    else:
        print("[BONDINVEST] Зависимости уже установлены — пропускаю npm install.")


def port_is_free(port: int) -> bool:
    """Проверка, свободен ли TCP-порт (чтобы не стартовать на занятом)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def wait_for_http(url: str, timeout: float = 30.0) -> bool:
    """
    Ожидание готовности HTTP-сервера: опрашиваем корень URL каждые 0.5с,
    пока не получим любой ответ или не истечёт таймаут.
    """
    try:
        from urllib.request import urlopen
    except ImportError:  # pragma: no cover
        return True
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def start_model_api() -> subprocess.Popen | None:
    """
    Фоновый запуск API математической модели (stdlib http.server, без uvicorn).
    Возвращает Popen или None, если порт 8000 уже занят другим процессом.
    """
    if not port_is_free(8000):
        print("[BONDINVEST] Порт 8000 занят — считаю, что API модели уже запущен.")
        return None
    print("[BONDINVEST] Запускаю API модели: python3 api.py --port 8000")
    return subprocess.Popen(
        [sys.executable, "api.py", "--port", "8000"],
        cwd=MODEL_DIR,
    )


def start_vite_devserver(port: int, npm_cmd: str) -> subprocess.Popen:
    """
    Запуск dev-сервера Vite через `npm run dev`.
    --strictPort гарантирует, что сервер НЕ уедет на другой порт молча:
    лучше упасть с понятной ошибкой, чем открыть не тот URL.

    ВАЖНО про Windows: аргументы вида `--port 3000` нужно передавать npm
    ЧЕРЕЗ разделитель `--`, иначе сам npm перехватит их как собственные опции.
    Команда запускается через run_npm(): на Windows это shell=True (cmd сам
    резолвит npm.cmd по PATHEXT — защита от FileNotFoundError [WinError 2]),
    а список аргументов Python экранирует до конкатенации в строку.
    """
    cmd = ["run", "dev", "--", "--port", str(port), "--strictPort"]
    print(f"[BONDINVEST] Старт Vite: {npm_cmd} {' '.join(cmd)} (cwd={APP_DIR})")
    full = [npm_cmd] + cmd
    if os.name == "nt":
        return subprocess.Popen(full, cwd=APP_DIR, shell=True)
    return subprocess.Popen(full, cwd=APP_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(description="Запуск UI BONDINVEST в браузере")
    parser.add_argument("--port", type=int, default=5173, help="порт Vite (default 5173)")
    parser.add_argument(
        "--with-model",
        action="store_true",
        help="дополнительно поднять Python API модели на :8000",
    )
    parser.add_argument(
        "--no-browser", action="store_true", help="не открывать браузер автоматически"
    )
    args = parser.parse_args()

    if not os.path.isdir(APP_DIR):
        die(f"Папка приложения не найдена: {APP_DIR}")

    check_node()
    npm_cmd = resolve_npm()
    ensure_dependencies(npm_cmd)

    model_proc = start_model_api() if args.with_model else None
    vite_proc = start_vite_devserver(args.port, npm_cmd)

    url = f"http://localhost:{args.port}"
    # Ждём поднятия сервера в отдельном потоке, чтобы vite-логи печатались сразу.
    def _open_when_ready() -> None:
        if wait_for_http(url + "/", timeout=40):
            print(f"[BONDINVEST] UI готов: {url}")
            if not args.no_browser:
                webbrowser.open(url)   # откроет системный браузер по умолчанию
        else:
            print("[BONDINVEST] Сервер не ответил за 40с — проверьте лог выше.", file=sys.stderr)

    threading.Thread(target=_open_when_ready, daemon=True).start()

    try:
        vite_proc.wait()               # блокируемся до остановки dev-сервера
    except KeyboardInterrupt:
        print("\n[BONDINVEST] Останавливаю процессы…")
    finally:
        for p in (vite_proc, model_proc):
            if p and p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    p.kill()
    print("[BONDINVEST] Готово.")


if __name__ == "__main__":
    main()
