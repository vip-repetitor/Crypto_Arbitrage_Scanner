"""
model.py — математическая модель индексов участия BONDINVEST (source of truth).

Вся финансовая логика проекта вынесена из фронтенда в этот Python-модуль.
Весовые коэффициенты (пороги и бонусы) НЕ зашиты в код — они читаются из
config.yaml, который можно менять без правки скриптов.

Формула:
    Индекс = base_index + Б(стрейк/лояльность) + Б(объём) + Б(активность)
    Ожидаемый бонус, ₽/год = Индекс * rub_per_index_point  (при депозите 1000₽)

Публичный API модуля:
    ModelConfig.load(path)            — загрузка конфига с валидацией
    ParticipationIndex.compute(...)   — индекс + детали по трём целям
    expected_bonus_rub(index, ...)    — перевод индекса в рубли
    goal_status(...)                  — статус цели для UI
    user_yield_pct / company_margin   — экономика продукта
    export_frontend_config(...)       — генерация JSON для фронтенда

Зависимости только стандартные + PyYAML (см. requirements.txt).
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as e:  # pragma: no cover - окружение без PyYAML
    raise SystemExit(
        "Нужен PyYAML: pip install -r requirements.txt"
    ) from e

DEFAULT_CONFIG_PATH = Path(__file__).parent / "config.yaml"


# ---------------------------------------------------------------------------
# Конфигурация модели
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Threshold:
    """Один порог цели: при current >= value начисляется bonus к индексу."""
    value: float
    bonus: float


@dataclass(frozen=True)
class GoalDef:
    """Описание цели из конфига: id, заголовок, единица измерения, пороги."""
    id: str
    title: str
    icon: str
    unit: str
    thresholds: tuple[Threshold, ...]

    @property
    def max_threshold(self) -> float:
        """Верхняя отображаемая планка прогресс-бара (максимальный порог)."""
        return max(t.value for t in self.thresholds)


@dataclass(frozen=True)
class Economics:
    """Справочная экономика продукта: откуда берётся yield пользователя."""
    ofz_yield_pct: float = 11.0
    user_target_min_pct: float = 6.0
    user_target_max_pct: float = 7.0
    company_margin_pct: float = 3.0
    reserve_pct: float = 1.0


@dataclass(frozen=True)
class ModelConfig:
    """
    Полная конфигурация модели, загруженная из YAML.

    base_index          — гарантированная часть индекса всем (≈4% годовых);
    rub_per_index_point — курс: сколько ₽/год даёт 1.0 индекса на 1000₽;
    goals               — три цели с порогами/бонусами;
    almost_achieved_ratio — доля цели для напоминания «почти достигнута».
    """
    base_index: float
    rub_per_index_point: float
    goals: dict[str, GoalDef]
    economics: Economics
    almost_achieved_ratio: float = 0.9
    version: int = 1

    @property
    def max_index(self) -> float:
        """Максимально возможный индекс = base + сумма лучших бонусов целей."""
        best = sum(max(t.bonus for t in g.thresholds) for g in self.goals.values())
        return round(self.base_index + best, 10)

    # -- загрузка ------------------------------------------------------------

    @classmethod
    def load(cls, path: str | Path = DEFAULT_CONFIG_PATH) -> "ModelConfig":
        """Читает YAML, валидирует структуру, возвращает неизменяемый конфиг.

        Валидация принципиальная: веса модели влияют на реальные выплаты,
        поэтому битый конфиг должен падать сразу, а не считаться «как-нибудь».
        """
        raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError(f"Конфиг {path}: ожидается mapping верхнего уровня")

        goals: dict[str, GoalDef] = {}
        for gid, g in (raw.get("goals") or {}).items():
            thresholds = tuple(
                sorted(
                    (Threshold(float(t["value"]), float(t["bonus"]))
                     for t in (g.get("thresholds") or [])),
                    key=lambda t: t.value,
                )
            )
            if not thresholds:
                raise ValueError(f"Цель '{gid}': пустой список порогов")
            if any(t.bonus <= 0 for t in thresholds):
                raise ValueError(f"Цель '{gid}': бонус должен быть > 0")
            if any(a.value == b.value for a, b in zip(thresholds, thresholds[1:])):
                raise ValueError(f"Цель '{gid}': дублирование значений порогов")
            goals[gid] = GoalDef(
                id=gid,
                title=str(g.get("title", gid)),
                icon=str(g.get("icon", "🎯")),
                unit=str(g.get("unit", "")),
                thresholds=thresholds,
            )

        missing = {"loyalty", "volume", "activity"} - set(goals)
        if missing:
            raise ValueError(f"Конфиг: нет обязательных целей: {sorted(missing)}")

        econ_raw = raw.get("economics") or {}
        return cls(
            base_index=float(raw.get("base_index", 0.1)),
            rub_per_index_point=float(raw.get("rub_per_index_point", 75.0)),
            goals=goals,
            economics=Economics(**{
                k: float(v) for k, v in econ_raw.items() if k in Economics.__dataclass_fields__
            }),
            almost_achieved_ratio=float(raw.get("almost_achieved_ratio", 0.9)),
            version=int(raw.get("version", 1)),
        )


# ---------------------------------------------------------------------------
# Расчёт индекса участия
# ---------------------------------------------------------------------------

def achieved_threshold(thresholds: tuple[Threshold, ...], current: float) -> Threshold | None:
    """Последний (максимальный) достигнутый порог или None.

    Если пользователь перескочил сразу несколько ступеней, учитывается
    наивысшая достигнутоая — бонус не «складывается» по ступеням.
    """
    passed = [t for t in sorted(thresholds, key=lambda t: t.value) if current >= t.value]
    return passed[-1] if passed else None


def next_threshold(thresholds: tuple[Threshold, ...], current: float) -> Threshold | None:
    """Ближайший недостиженный порог или None (все закрыты)."""
    for t in sorted(thresholds, key=lambda t: t.value):
        if current < t.value:
            return t
    return None


@dataclass
class GoalResult:
    """Результат расчёта по одной цели — готов к отдаче в API/UI."""
    id: str
    title: str
    icon: str
    unit: str
    current: float
    target: float                 # отображаемая планка = максимальный порог
    percent: int                  # 0..100, кламп сверху (перевыполнение ок)
    status: str                   # empty | in_progress | achieved | locked
    bonus: float                  # текущий заработанный бонус (0 если не достигнут 1-й порог)
    remaining: float              # сколько осталось до ближайшего порога
    hint: str                     # человекочитаемая подсказка для карточки
    almost_achieved: bool         # >= almost_achieved_ratio и ещё не achieved

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class IndexBreakdown:
    """Итоговый индекс участия с разбивкой — то, что рисует Dashboard."""
    total: float
    base: float
    contributions: dict[str, float]   # goal_id -> вклад в индекс
    max_total: float
    expected_bonus_rub: float         # ₽/год на базовом депозите
    deposit_rub: float
    goals: list[GoalResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = {k: v for k, v in self.__dict__.items()}
        d["goals"] = [g.to_dict() for g in self.goals]
        return d


class ParticipationIndex:
    """
    Расчёт индекса: Индекс = base + Σ достутых бонусов трёх целей.

    Экземпляр привязан к ModelConfig — меняете веса в YAML, пересоздаёте
    объект, и вся цепочка (API, фронт, стресс-тесты) считает по-новому.
    """

    def __init__(self, config: ModelConfig):
        self.config = config

    # -- одна цель ----------------------------------------------------------

    def evaluate_goal(self, goal_id: str, current: float) -> GoalResult:
        """Переводит «сырое» значение цели в статус/бонус/подсказку для UI.

        Двухпороговая модель отображения (как в фронт-моке ТЗ):
          target карточки = БЛИЖАЙШИЙ недостиженный порог, а если все закрыты —
          последний достигнутый. Поэтому 4 пополнения при порогах [3,6] дают
          target=3 и percent=100 (перевыполнение клампится), а не 67% до 6.
        """
        g = self.config.goals[goal_id]
        last_t = g.thresholds[-1]
        achieved = achieved_threshold(g.thresholds, current)
        nxt = next_threshold(g.thresholds, current)

        # Статусы соответствуют состояниям ProgressBar из ТЗ:
        # Empty (ничего нет) -> in_progress (есть движение, бонус не заработан)
        # -> achieved (первый/следующий порог закрыт, бонус активен).
        if achieved is not None:
            status = "achieved"
        elif current > 0:
            status = "in_progress"
        else:
            status = "empty"

        # Планка прогресс-бара: пока ни один порог не закрыт — ближайший порог;
        # как только бонус активен — бар показывает «первый уровень выполнен» (100%),
        # а рост к следующему уровню отражает hint («До следующего уровня: N»).
        # Это паритет с фронт-моком ТЗ: 4/3 пополнений -> achieved, 100%.
        # Планка прогресс-бара (аудит 2026-10): всегда СЛЕДУЮЩИЙ недостиженный
        # порог; если все пороги закрыты — последний достигнутый (бар = 100%).
        # Старое поведение (target = достигнутый порог) при 12/20 неделях рисовало
        # бар 100%, хотя до следующего уровня оставалось 8 недель — некорректная
        # отрисовка прогресса. Теперь 12 нед -> 60% до планки 20, как в макете ТЗ.
        if nxt is not None:
            target = nxt.value
        else:
            target = last_t.value
        percent = 0 if target <= 0 else min(100, round(current / target * 100))
        remaining = 0.0 if nxt is None else round(nxt.value - current, 10)

        # Подсказка: «До следующего уровня», либо «Осталось X до разблокировки»
        unit_suffix = "₽" if g.unit == "₽" else " " + g.unit
        if nxt is None:
            hint = "Все уровни пройдены 🎉"
        elif achieved is None:
            hint = f"Осталось: {fmt_num(remaining)}{unit_suffix} до разблокировки"
        elif current >= nxt.value:
            # Порог закрыт с запасом (4 пополнения при цели 3): бонус активен,
            # до следующего уровня ещё далеко — честная подсказка вместо
            # «дождите 2 пополнений», которые уже есть.
            hint = "Бонус активен!"
        else:
            hint = f"До следующего уровня: {fmt_num(remaining)}{unit_suffix}"

        almost = (
            status != "achieved"
            and target > 0
            and current / target >= self.config.almost_achieved_ratio
        )

        return GoalResult(
            id=g.id, title=g.title, icon=g.icon, unit=g.unit,
            current=current, target=target, percent=percent,
            status=status, bonus=achieved.bonus if achieved else 0.0,
            remaining=remaining, hint=hint, almost_achieved=almost,
        )

    # -- общий индекс ---------------------------------------------------------

    def compute(self, loyalty_weeks: float, avg_volume_rub: float,
                deposits_per_month: float, deposit_rub: float = 1000.0) -> IndexBreakdown:
        """Главная формула продукта: индекс по трём целям + ожидаемый бонус в ₽."""
        currents = {
            "loyalty": float(loyalty_weeks),
            "volume": float(avg_volume_rub),
            "activity": float(deposits_per_month),
        }
        results = [self.evaluate_goal(gid, val) for gid, val in currents.items()]
        contributions = {r.id: r.bonus for r in results}
        # round(...,2): сложение float-бонусов (0.1+0.3+0.2) даёт 0.6000000000000001;
        # индекс всегда двух знаков — как в UI («0.6 / 1.3»).
        total = round(self.config.base_index + sum(contributions.values()), 2)
        return IndexBreakdown(
            total=total,
            base=self.config.base_index,
            contributions=contributions,
            max_total=self.config.max_index,
            expected_bonus_rub=expected_bonus_rub(total, self.config, deposit_rub),
            deposit_rub=deposit_rub,
            goals=results,
        )


# ---------------------------------------------------------------------------
# Деньги и экономика
# ---------------------------------------------------------------------------

def expected_bonus_rub(index: float, config: ModelConfig, deposit_rub: float = 1000.0) -> float:
    """Ожидаемый годовой бонус в рублях.

    Логика: 1.0 индекса = rub_per_index_point ₽/ГОНА на базовых 1000₽;
    масштаб линейный по сумме депозита. Округление до 0.1 ₽ («~45₽/год»).
    """
    return round(index * config.rub_per_index_point * (deposit_rub / 1000.0), 1)


GUARANTEED_YIELD_PCT = 4.0  # «гарантированные 4% годовых» — купон ОФЗ, получают все


def user_yield_pct(index: float, config: ModelConfig) -> float:
    """Полная годовая доходность пользователя = гарантия + бонусная надбавка.

    Экономическая модель (из описания продукта):
      • 4% — базовый купон ОФЗ («ГАРАНТИРОВАННО», получают все);
      • надбавка за цели: 0.1 индекса = 0.75 п.п. при дефолтном курсе 75 ₽/п.и.
        (проверка по моку ТЗ: индекс 0.6 -> «~45₽/год» на 1000₽ -> +4.5 п.п.;
         индекс 0.8 -> ровно маркетинговые «до 10% годовых»);
      • максимум модели: 4 + 9.75 = 13.75% — стресс-тесты показывают, что
        выше 10% маржа выходит за целевой коридор, поэтому маркетинг честно
        обещает «до ~10%».
    """
    bonus_pp = index * config.rub_per_index_point / 10.0
    return round(GUARANTEED_YIELD_PCT + bonus_pp, 2)


def company_margin_pct(index: float, config: ModelConfig) -> float:
    """Маржа компании = ОФЗ минус БОНУСНАЯ надбавка пользователя минус резерв.

    Важно: базовые 4% купона — это не расход продукта (клиент получил бы их
    и без участия), поэтому из 11% ОФЗ вычитаем только надбавку за цели и 1%
    резерва. Витрина пользователя при этом показывает полный yield (гарантия +
    надбавка). Дефолтные веса укладываются в коридор ТЗ:
      индекс 0.1 -> выплата 0.75 п.п., маржа 9.25%;
      индекс 0.6 -> 4.5 п.п.,          маржа 5.5%;
      индекс 0.8 -> 6 п.п. («до 10%»), маржа ровно 4.0% (целевые 3-4%).
    """
    bonus_pp = index * config.rub_per_index_point / 10.0
    return round(config.economics.ofz_yield_pct - bonus_pp - config.economics.reserve_pct, 2)


def fmt_num(x: float) -> str:
    """Красивое число без хвостовых нулей: 500.0 -> '500', 22.5 -> '22.5'."""
    return str(int(x)) if float(x).is_integer() else str(round(x, 2))


# ---------------------------------------------------------------------------
# Мок-пользователь (паритет с фронтенд-демо) + экспорт конфига во фронт
# ---------------------------------------------------------------------------

MOCK_USER = {
    "loyalty_weeks": 12,
    "avg_volume_rub": 1500,
    "deposits_per_month": 4,
    "deposit_rub": 1000,
}


def demo_snapshot(config: ModelConfig | None = None) -> dict[str, Any]:
    """Снимок для демо: индекс 0.6 при дефолтных весах (12нед/1500₽/4поп)."""
    cfg = config or ModelConfig.load()
    idx = ParticipationIndex(cfg).compute(**MOCK_USER)
    return idx.to_dict()


def export_frontend_config(config_path: str | Path = DEFAULT_CONFIG_PATH,
                           out_path: str | Path | None = None) -> Path:
    """Пишет app/src/generated/model-config.json — фронт читает веса оттуда.

    Это мост «один источник правды»: TS-код больше не хранит пороги сам,
    он подхватывает их из файла, сгенерированного этим модулем.
    """
    cfg = ModelConfig.load(config_path)
    out = Path(out_path) if out_path else (
        Path(config_path).parent.parent / "app" / "src" / "generated" / "model-config.json"
    )
    payload = {
        "version": cfg.version,
        "baseIndex": cfg.base_index,
        "rubPerIndexPoint": cfg.rub_per_index_point,
        "maxIndex": cfg.max_index,
        "almostAchievedRatio": cfg.almost_achieved_ratio,
        "goals": [
            {
                "id": g.id, "title": g.title, "icon": g.icon, "unit": g.unit,
                "thresholds": [{"value": t.value, "bonus": t.bonus} for t in g.thresholds],
            }
            for g in cfg.goals.values()
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":  # быстрая проверка: python model.py
    snap = demo_snapshot()
    print(json.dumps(snap, ensure_ascii=False, indent=2))
    print(f"\nИндекс: {snap['total']} из {snap['max_total']} · "
          f"ожидается ~{snap['expected_bonus_rub']}₽/год · "
          f"yield пользователя {user_yield_pct(snap['total'], ModelConfig.load())}%")
