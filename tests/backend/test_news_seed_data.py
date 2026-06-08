from datetime import datetime
import importlib.util
from pathlib import Path
import random

from news_fixtures import build_news_fixtures


BACKEND_DIR = Path(__file__).resolve().parents[2] / "apps" / "backend"
SEED_DEMO_PATH = BACKEND_DIR / "routes" / "seed_demo.py"
seed_demo_spec = importlib.util.spec_from_file_location("seed_demo_route_module", SEED_DEMO_PATH)
seed_demo = importlib.util.module_from_spec(seed_demo_spec)
assert seed_demo_spec.loader is not None
seed_demo_spec.loader.exec_module(seed_demo)


def test_news_fixtures_include_full_localized_summary_fields():
    items = build_news_fixtures(datetime(2026, 6, 8, 12, 0, 0))

    assert items
    for item in items:
        assert item["source_lang"] == "ru"
        assert item["translation_status"] == "translated"
        assert item["title"] == item["title_ru"]
        assert item["content"] == item["content_ru"]
        assert item["summary"] == item["summary_ru"]
        assert item["title_en"]
        assert item["content_en"]
        assert item["summary_en"]
        assert item["summary_kz"]
        assert item["summary_en"] != item["summary_ru"]


def test_seed_demo_date_window_tracks_current_date():
    date_from, date_to = seed_demo.get_seed_date_bounds(datetime(2026, 6, 8, 12, 34, 56))

    assert date_from == datetime(2026, 3, 10, 7, 0, 0)
    assert date_to == datetime(2026, 6, 8, 23, 59, 59, 999000)


def test_seed_demo_request_dates_stay_inside_seed_window():
    rng = random.Random(42)
    date_from, date_to = seed_demo.get_seed_date_bounds(datetime(2026, 6, 8, 12, 0, 0))
    used_timestamps = set()

    for sequence, status in enumerate(("pending", "in_progress", "closed")):
        created_at, updated_at, closed_at = seed_demo.make_dates(
            rng,
            status,
            date_from,
            date_to,
            used_timestamps,
            sequence,
        )

        assert date_from <= created_at <= date_to
        assert date_from <= updated_at <= date_to
        if closed_at is not None:
            assert date_from <= closed_at <= date_to
