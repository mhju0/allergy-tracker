"""Unit characterization of the single allergy test-status classifier.

`_status_from_dates` is the one place that maps
(start, end, now, has_reaction, requested override) → test_status. Both create
orchestrators, the lazy recompute, and (after the 01a consolidation) both
scheduler jobs route through it. These tests pin its exact matrix so any future
change to the traffic-light rule is caught here first — the one test surface the
allergy core lacked.
"""
from datetime import datetime, timedelta, timezone

from app.crud.allergy.ingredient_testing import _status_from_dates

UTC = timezone.utc
NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _window(start_offset_hours: float, duration_hours: float = 72):
    start = NOW + timedelta(hours=start_offset_hours)
    return start, start + timedelta(hours=duration_hours)


# ── date branches ─────────────────────────────────────────────────────────────

def test_future_start_is_none():
    start, end = _window(+1)  # starts in 1h → not yet observing
    assert _status_from_dates(start, end, NOW) is None


def test_in_window_without_reaction_is_testing():
    start, end = _window(-1)  # started 1h ago, 72h window open
    assert _status_from_dates(start, end, NOW) == "testing"


def test_in_window_with_reaction_stays_testing():
    # Preserve: the date classifier ignores reactions while the window is open;
    # the immediate-confirm on a recorded reaction lives in create_symptom_check.
    start, end = _window(-1)
    assert _status_from_dates(start, end, NOW, has_reaction=True) == "testing"


def test_elapsed_without_reaction_is_completed_safe():
    start, end = _window(-80)  # window ended 8h ago
    assert _status_from_dates(start, end, NOW) == "completed_safe"


def test_elapsed_with_reaction_is_completed_reaction():
    start, end = _window(-80)
    assert _status_from_dates(start, end, NOW, has_reaction=True) == "completed_reaction"


# ── explicit requested_status override wins over the date branches ───────────

def test_requested_reaction_overrides_open_window():
    start, end = _window(-1)  # still in window, would be "testing"
    assert (
        _status_from_dates(start, end, NOW, requested_status="completed_reaction")
        == "completed_reaction"
    )


def test_requested_safe_overrides_open_window():
    start, end = _window(-1)
    assert (
        _status_from_dates(start, end, NOW, requested_status="completed_safe")
        == "completed_safe"
    )


def test_requested_override_wins_over_future_start():
    start, end = _window(+5)  # future → None without the override
    assert (
        _status_from_dates(start, end, NOW, requested_status="completed_reaction")
        == "completed_reaction"
    )


# ── boundaries (strict <): the scheduler jobs now share these exact edges ─────

def test_now_equals_end_is_terminal():
    # At exactly test_end_date the window is over → terminal, not "testing".
    start, end = _window(-72)  # end == NOW
    assert end == NOW
    assert _status_from_dates(start, end, NOW) == "completed_safe"


def test_now_equals_start_is_in_window():
    start, end = _window(0)  # start == NOW
    assert _status_from_dates(start, end, NOW) == "testing"
