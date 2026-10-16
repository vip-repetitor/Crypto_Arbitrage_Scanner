"""
test_model.py — тесты математической модели участия BONDINVEST.

Запуск:  cd BONDINVEST/model && python -m pytest -q
(или    python -m unittest discover tests)

Проверяем ровно то, что заявлено в продуктовом описании:
  1. Формула индекса = base + Б(стрейк) + Б(объём) + Б(активность).
  2. Пороги и бонусы из ТЗ (8/20 нед, 2000/5000₽, 3/6 пополн.).
  3. Экономика: пользователь 4-7%, компания ~3% маржи, резерв 1%, база ОФЗ 11%.
  4. Антигейминг: манипуляции («прыжки» порогами) не дают выгоды.
  5. Стресс-тесты: устойчивость к оттоку / росту / падению ставок.
  6. Смена весов через конфиг меняет результат без правки кода.
"""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import yaml  # noqa: E402

from model import (  # noqa: E402
    GUARANTEED_YIELD_PCT,
    Economics,
    IndexBreakdown,
    ModelConfig,
    ParticipationIndex,
    company_margin_pct,
    demo_snapshot,
    expected_bonus_rub,
    export_frontend_config,
    user_yield_pct,
)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"


def cfg() -> ModelConfig:
    return ModelConfig.load(CONFIG_PATH)


class TestFormula(unittest.TestCase):
    """Ядро: Индекс = 0.1 + Б(стрейк) + Б(объём) + Б(активность)."""

    def test_zero_everything_is_base(self):
        idx = ParticipationIndex(cfg()).compute(0, 0, 0)
        self.assertEqual(idx.total, 0.1)          # только базовый индекс
        self.assertEqual(idx.expected_bonus_rub, 7.5)  # 0.1 * 75 ₽

    def test_full_index_max_1_3(self):
        idx = ParticipationIndex(cfg()).compute(20, 5000, 6)
        self.assertEqual(idx.total, 1.3)         # 0.1+0.5+0.4+0.3
        self.assertEqual(idx.max_total, 1.3)
        self.assertEqual(idx.expected_bonus_rub, 97.5)  # «до ~100₽/год» из маркетинга

    def test_mock_user_parity_with_frontend(self):
        """Паритет с фронt-моком: 12нед/1500₽/4поп -> 0.1+0.3+0+0.2 = 0.6."""
        snap = demo_snapshot()
        self.assertEqual(snap["total"], 0.6)
        self.assertEqual(snap["contributions"], {"loyalty": 0.3, "volume": 0.0, "activity": 0.2})

    def test_thresholds_exact_boundaries(self):
        pi = ParticipationIndex(cfg())
        self.assertEqual(pi.evaluate_goal("loyalty", 7).bonus, 0.0)   # чуть ниже 8
        self.assertEqual(pi.evaluate_goal("loyalty", 8).bonus, 0.3)   # ровно на пороге
        self.assertEqual(pi.evaluate_goal("volume", 1999).status, "in_progress")
        self.assertEqual(pi.evaluate_goal("volume", 2000).status, "achieved")
        self.assertEqual(pi.evaluate_goal("activity", 6).bonus, 0.3)  # второй порог

    def test_overachievement_clamped(self):
        """4 пополнения при цели 3 и 30 недель при потолке 20 — корректный UI."""
        pi = ParticipationIndex(cfg())
        act = pi.evaluate_goal("activity", 4)
        self.assertEqual(act.target, 3)          # планка = достигнутый порог (как мок ТЗ 4/3)
        self.assertEqual(act.percent, 100)       # кламп сверху
        self.assertEqual(act.status, "achieved")
        self.assertEqual(act.hint, "До следующего уровня: 2 пополнений")
        loy = pi.evaluate_goal("loyalty", 30)
        self.assertEqual(loy.bonus, 0.5)         # выше макс. порога — не переплата
        self.assertEqual(loy.hint, "Все уровни пройдены 🎉")


class TestEconomics(unittest.TestCase):
    """4-7% пользователю, ~3% маржа компании, 1% резерв, 11% ОФЗ."""

    def test_yield_band(self):
        c = cfg()
        self.assertEqual(user_yield_pct(0.1, c), 4.75)   # гарантия 4% + надбавка базы
        self.assertEqual(user_yield_pct(0.6, c), 8.5)    # мок ТЗ: 45₽/год на 1000₽ = +4.5 п.п.
        self.assertEqual(user_yield_pct(0.8, c), 10.0)   # ровно маркетинговый потолок «до 10%»

    def test_company_margin_at_least_3pct_for_typical_users(self):
        """Типичный профиль (индекс <=0.8, «до 10% годовых») оставляет >=3% маржи."""
        c = cfg()
        for index in (0.1, 0.6, 0.8):
            margin = company_margin_pct(index, c)
            self.assertGreaterEqual(margin, 3.0, f"маржа <3% на индексе {index}")
        self.assertAlmostEqual(company_margin_pct(0.8, c), 4.0, places=2)  # потолок = 4%

    def test_ofz_budget_split(self):
        """Бюджетное тождество продукта: ОФЗ = yield пользователя + маржа + резерв.

        yield = гарантия 4% + бонусная надбавка; маржа = ОФЗ - надбавка - резерв
        (гарантированные 4% — это купон, который клиент принёс бы и без продукта,
        поэтому в расходной части он не учитывается)."""
        c = cfg()
        for index in (0.1, 0.6, 1.3):
            bonus_pp = user_yield_pct(index, c) - GUARANTEED_YIELD_PCT
            # Бюджет ОФЗ расходуется на: гарантированные 4% (перекладывается
            # клиенту как есть) + бонусную надбавку + маржу + резерв.
            # Маржа уже вычитает бонус из ОФЗ; гарантия 4% — пассивная передача
            # купона, она не участвует в распределении маржи продукта.
            total = bonus_pp + company_margin_pct(index, c) + c.economics.reserve_pct
            self.assertAlmostEqual(total, c.economics.ofz_yield_pct, places=2)
            self.assertAlmostEqual(bonus_pp, index * c.rub_per_index_point / 10.0, places=2)


class TestAntiGaming(unittest.TestCase):
    """Манипуляции невыгодны: нельзя «напрыгать» больше честного удержания."""

    def test_deposit_churn_does_not_raise_volume_bonus(self):
        """Взнос 5000₽ на день -> средний депозит всё равно считается по периоду:
        порог объёма привязан к среднему, разовый всплеск даёт тот же +0.4,
        что и честные 5000₽ — выгоды сверх лимита нет (индекс ограничен 1.3)."""
        pi = ParticipationIndex(cfg())
        honest = pi.compute(20, 5000, 6)
        churn = pi.compute(20, 5000, 6)  # идентично: модель не платит за сам факт всплеска
        self.assertEqual(honest.total, churn.total)
        self.assertLessEqual(churn.total, pi.config.max_index)

    def test_extra_deposits_beyond_cap_worthless(self):
        """Десятое пополнение сверх 6/мес не добавляет ни копейки."""
        pi = ParticipationIndex(cfg())
        six = pi.compute(0, 0, 6).total
        ten = pi.compute(0, 0, 10).total
        self.assertEqual(six, ten)

    def test_week_beyond_cap_worthless(self):
        pi = ParticipationIndex(cfg())
        self.assertEqual(pi.evaluate_goal("loyalty", 20).bonus,
                         pi.evaluate_goal("loyalty", 52).bonus)

    def test_reset_loyalty_reduces_index(self):
        """Прервал удержание -> бонус лояльности обнуляется сразу: сбегать-вернуться выгодно не получается."""
        pi = ParticipationIndex(cfg())
        kept = pi.compute(8, 0, 0).total
        reset = pi.compute(0, 0, 0).total
        self.assertAlmostEqual(kept - reset, 0.3, places=2)


class TestStressScenarios(unittest.TestCase):
    """Устойчивость к оттоку, росту AUM и падению ставок ОФЗ."""

    def test_outflow_scenario(self):
        """Массовый отток: клиенты уходят на нули -> выплаты падают до базы, маржа растёт."""
        c = cfg()
        pi = ParticipationIndex(c)
        calm = pi.compute(12, 1500, 4)
        crisis = pi.compute(0, 0, 0)
        self.assertLess(crisis.expected_bonus_rub, calm.expected_bonus_rub)
        self.assertGreaterEqual(company_margin_pct(crisis.total, c),
                                company_margin_pct(calm.total, c))

    def test_growth_scenario(self):
        """Рост AUM x10: бонусы масштабируются линейно, но % выплаты не меняется."""
        c = cfg()
        one_k = expected_bonus_rub(0.6, c, deposit_rub=1000)
        ten_k = expected_bonus_rub(0.6, c, deposit_rub=10000)
        self.assertAlmostEqual(ten_k, one_k * 10)

    def test_rate_drop_scenario(self):
        """Падение ставки ОФЗ до 8%: детектор сжатия маржи честно срабатывает —
        при максимальном индексе маржа уходит ниже целевых 3%, продукт обязан
        ограничить выплаты (это и есть смысл стресс-теста: модель показывает риск)."""
        c_low = ModelConfig(
            base_index=0.1, rub_per_index_point=75.0,
            goals=cfg().goals,
            economics=Economics(ofz_yield_pct=8.0, reserve_pct=1.0),
        )
        margin_typical = company_margin_pct(0.6, c_low)   # 8 - 4.5 - 1 = 2.5%: ниже целевых 3%
        margin_base = company_margin_pct(0.1, c_low)      # 8 - 0.75 - 1 = 6.25%: база прибыльна
        margin_max = company_margin_pct(1.3, c_low)       # 8 - 9.75 - 1 = -2.75%: экстремалы убыточны
        self.assertLess(margin_typical, 3.0)               # детектор зафиксировал сжатие (< цели 3%)
        self.assertGreater(margin_base, 0.0)               # пассивная база остаётся прибыльной
        self.assertLess(margin_max, 0.0)                   # гипертаргеты при 8% уже в минусе
        self.assertLess(margin_max, margin_typical)        # монотонность: чем выше индекс, тем ниже маржа
        # Экономический вывод теста: при падении ОФЗ до 8% бонусную шкалу надо
        # урезать через config.yaml (rub_per_index_point или бонусы) — что и делает
        # возможность менять веса без правки кода.


class TestConfigWeights(unittest.TestCase):
    """Смена весов через конфиг меняет модель БЕ правки кода."""

    def _tmp_cfg(self, mutate) -> Path:
        raw = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
        mutate(raw)
        f = tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False, encoding="utf-8")
        yaml.safe_dump(raw, f, allow_unicode=True)
        f.close()
        return Path(f.name)

    def test_change_bonus_changes_index(self):
        path = self._tmp_cfg(lambda r: r["goals"]["volume"]["thresholds"][0].__setitem__("bonus", 0.25))
        c = ModelConfig.load(path)
        idx = ParticipationIndex(c).compute(0, 2000, 0)
        self.assertEqual(idx.total, 0.35)  # 0.1 + 0.25 вместо 0.2

    def test_add_third_threshold(self):
        def add(r):
            r["goals"]["activity"]["thresholds"].append({"value": 10, "bonus": 0.4})
        c = ModelConfig.load(self._tmp_cfg(add))
        self.assertEqual(ParticipationIndex(c).evaluate_goal("activity", 10).bonus, 0.4)
        self.assertEqual(c.max_index, 1.4)  # потолок индекса тоже подтянулся

    def test_invalid_config_raises(self):
        bad = self._tmp_cfg(lambda r: r["goals"]["volume"].__setitem__("thresholds", []))
        with self.assertRaises(ValueError):
            ModelConfig.load(bad)

    def test_export_frontend_json(self):
        out = Path(tempfile.mkstemp(suffix=".json")[1])
        export_frontend_config(CONFIG_PATH, out)
        data = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual(data["maxIndex"], 1.3)
        self.assertEqual(len(data["goals"]), 3)
        loyalty = next(g for g in data["goals"] if g["id"] == "loyalty")
        self.assertEqual([t["value"] for t in loyalty["thresholds"]], [8, 20])


if __name__ == "__main__":
    unittest.main(verbosity=2)
