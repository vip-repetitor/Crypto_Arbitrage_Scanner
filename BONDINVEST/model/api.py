"""
api.py — минимальный HTTP API поверх математической модели (stdlib, без FastAPI).

Зачем: бэкенд MVP по backend_plan.yaml начинается с отдачи индекса. Этот скрипт
позволяет запустить «сервер модели» одной командой уже сейчас:

    python3 api.py [--port 8000] [--config config.yaml]

Эндпоинты:
    GET /api/config                 — текущие веса модели (из YAML)
    GET /api/index?loyalty=12&volume=1500&activity=4&deposit=1000
                                    — расчёт индекса участия и ожидаемого бонуса
    POST /api/reload                — перечитать config.yaml без рестарта процесса
                                      (главная фича конфига: меняем веса на лету)

Реализация: http.server + urllib.parse; каждый ответ — JSON из model.to_dict().
Один воркер достаточно для демо/MVP; комментарии помечают места, где в проде
будет middleware (CORS, кэш конфига, аутентификация пользователя).
"""
from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from model import ModelConfig, ParticipationIndex, export_frontend_config

# Состояние процесса: конфиг кэшируется в модульной переменной; POST /api/reload
# перечитывает файл — это дешёвый аналог hot-reload весовой модели.
CONFIG: ModelConfig = None  # type: ignore[assignment]
CONFIG_PATH: Path = Path(__file__).parent / "config.yaml"


class Handler(BaseHTTPRequestHandler):
    """Маршрутизация GET/POST над моделью. Никаких фреймворков — только stdlib."""

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # TODO(prod): CORS только для origin фронтенда, а не '*'
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 (имя метода задано stdlib)
        url = urlparse(self.path)
        if url.path == "/api/config":
            # Отдаём сериализованные веса — фронт может строить UI из них.
            self._json(200, {"goals": [
                {"id": g.id, "title": g.title, "icon": g.icon, "unit": g.unit,
                 "thresholds": [{"value": t.value, "bonus": t.bonus} for t in g.thresholds]}
                for g in CONFIG.goals.values()
            ], "baseIndex": CONFIG.base_index,
               "rubPerIndexPoint": CONFIG.rub_per_index_point,
               "maxIndex": CONFIG.max_index})
        elif url.path == "/api/index":
            q = parse_qs(url.query)
            try:
                # Значения приходят строками; приводим к float с дефолтами 0.
                idx = ParticipationIndex(CONFIG).compute(
                    loyalty_weeks=float(q.get("loyalty", ["0"])[0]),
                    avg_volume_rub=float(q.get("volume", ["0"])[0]),
                    deposits_per_month=float(q.get("activity", ["0"])[0]),
                    deposit_rub=float(q.get("deposit", ["1000"])[0]),
                )
                self._json(200, idx.to_dict())
            except ValueError as e:
                self._json(400, {"error": f"некорректные параметры: {e}"})
        else:
            self._json(404, {"error": "нет такого маршрута", "routes": ["/api/config", "/api/index", "/api/reload"]})

    def do_POST(self) -> None:  # noqa: N802
        global CONFIG
        if urlparse(self.path).path == "/api/reload":
            # Hot-reload весов: перечитать YAML и перегенерировать JSON для фронта.
            CONFIG = ModelConfig.load(CONFIG_PATH)
            out = export_frontend_config(CONFIG_PATH)
            self._json(200, {"reloaded": True, "version": CONFIG.version,
                             "maxIndex": CONFIG.max_index,
                             "frontendConfig": str(out)})
        else:
            self._json(404, {"error": "доступен только POST /api/reload"})

    def log_message(self, fmt: str, *args) -> None:  # тихий лог вместо спам-stdout
        print(f"[api] {self.address_string()} {fmt % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="BONDINVEST model API (stdlib)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--config", type=Path, default=Path(__file__).parent / "config.yaml")
    args = parser.parse_args()

    global CONFIG, CONFIG_PATH
    CONFIG_PATH = args.config
    CONFIG = ModelConfig.load(CONFIG_PATH)   # падение при битом конфиге — осознанное
    print(f"[api] модель загружена: max index = {CONFIG.max_index}, целей = {len(CONFIG.goals)}")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"[api] слушает http://127.0.0.1:{args.port}  (Ctrl+C — остановка)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[api] остановлено")


if __name__ == "__main__":
    main()
