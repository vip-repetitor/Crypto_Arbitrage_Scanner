# Запуск проекта BONDINVEST на Windows (PowerShell)

## Быстрый старт (один шаг)

```powershell
cd BONDINVEST
python run_ui.py
```

Скрипт сам: проверит Node.js, установит зависимости (`npm install`), запустит
dev-сервер Vite и откроет http://localhost:5173 в браузере по умолчанию.

Флаги:

| Команда | Что делает |
|---|---|
| `python run_ui.py --with-model` | дополнительно поднимает Python API модели выплат на :8000 |
| `python run_ui.py --port 3000` | свой порт Vite |
| `python run_ui.py --no-browser` | не открывать браузер автоматически |

Остановка — `Ctrl+C` (дочерние процессы завершаются корректно).

## Почему раньше падало (и что исправлено)

1. **`python3 : Имя "python3" не распознано`** — на Windows стандартный Python
   ставится как команда `python`, а `python3` обычно отсутствует (или это
   заглушка Microsoft Store). Используйте `python`.
2. **`FileNotFoundError: [WinError 2]` при `npm install`** — subprocess на
   Windows не умеет запускать `.cmd`-шимы по имени `npm`. Лаунчер теперь сам
   определяет рабочий вариант (`npm` → fallback `npm.cmd`) и использует его.
3. **`npm error Missing script: "dev"`** — скрипт `dev` лежит в `BONDINVEST/app`,
   а вы запускали `npm run dev` из корня репозитория. Правильно либо
   `python run_ui.py` (он сам делает cd в app/), либо вручную:
   `cd BONDINVEST\app; npm run dev`.

## Ручной запуск (если лаунчер не нужен)

```powershell
# 1. Зависимости + фронтенд
cd BONDINVEST\app
npm install
npm run dev            # откройте http://localhost:5173

# 2. Опционально: Python API математической модели (второе окно PowerShell)
cd BONDINVEST\model
pip install -r requirements.txt
python api.py --port 8000
```

## Проверки / разработка

```powershell
cd BONDINVEST\app
npm test               # vitest: юнит + компоненты + axe-core
npm run build          # production-сборка в dist/

cd BONDINVEST\model
python -m pytest tests -q   # тесты математической модели
```

## Требования

- Python 3.10+ (`python --version`)
- Node.js 18+ и npm (`node -v`, `npm -v`)
- Если `python` не найден — переустановите Python с галкой «Add to PATH»
  или уберите алиас `python3.exe` из Settings → Apps → App execution aliases.
