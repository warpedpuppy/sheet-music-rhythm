from app.services import rhythm, scoring
from .conftest import make_pattern, note, rest

# 60 BPM -> beat = 1000 ms, count-in = 4000 ms, tolerance = 250 ms, hit window = 100 ms.
PATTERN = make_pattern(*[note("q")] * 4)
TS = "4/4"
BPM = 60
ONSETS = [4000.0, 5000.0, 6000.0, 7000.0]


def test_perfect_taps_score_full():
    result = scoring.score_attempt(PATTERN, TS, BPM, list(ONSETS))
    assert [r.status for r in result.results] == ["hit"] * 4
    assert result.accuracy == 1.0
    assert result.passed is True
    assert result.extra_taps == []


def test_slightly_off_taps_still_hit():
    taps = [o + 80 for o in ONSETS]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    assert all(r.status == "hit" for r in result.results)
    assert result.accuracy == 1.0


def test_early_and_late_taps_get_partial_credit():
    taps = [4000.0 - 200, 5000.0 + 200, 6000.0, 7000.0]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    statuses = [r.status for r in result.results]
    assert statuses == ["early", "late", "hit", "hit"]
    assert result.accuracy == (0.5 + 0.5 + 1 + 1) / 4


def test_missing_tap_marks_note_missed():
    taps = [4000.0, 5000.0, 6000.0]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    assert result.results[3].status == "missed"
    assert result.accuracy == 0.75
    assert result.passed is False


def test_tap_far_outside_window_is_extra_and_note_missed():
    taps = [4000.0, 5000.0, 6000.0, 7600.0]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    assert result.results[3].status == "missed"
    assert result.extra_taps == [7600.0]
    # 3 hits - 0.25 extra penalty = 2.75 / 4
    assert result.accuracy == 0.6875


def test_double_tap_matches_once_and_penalizes_extra():
    taps = [4000.0, 4040.0, 5000.0, 6000.0, 7000.0]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    assert [r.status for r in result.results] == ["hit"] * 4
    assert len(result.extra_taps) == 1
    assert result.accuracy == (4 - 0.25) / 4


def test_no_taps_scores_zero():
    result = scoring.score_attempt(PATTERN, TS, BPM, [])
    assert all(r.status == "missed" for r in result.results)
    assert result.accuracy == 0.0
    assert result.passed is False


def test_rests_do_not_expect_taps():
    pattern = make_pattern(note("q"), rest("q"), note("q"), rest("q"))
    onsets = rhythm.expected_onsets(pattern, TS, BPM)
    result = scoring.score_attempt(pattern, TS, BPM, list(onsets))
    assert len(result.results) == 2
    assert result.accuracy == 1.0


def test_pass_threshold_boundary():
    # Three hits and one late: (3 + 0.5) / 4 = 0.875 -> pass.
    taps = [4000.0, 5000.0, 6000.0, 7200.0]
    result = scoring.score_attempt(PATTERN, TS, BPM, taps)
    assert result.accuracy == 0.875
    assert result.passed is True
    # Two hits, two missed = 0.5 -> fail.
    result = scoring.score_attempt(PATTERN, TS, BPM, [4000.0, 5000.0])
    assert result.passed is False


def test_tolerance_floor_for_fast_tempos():
    # 240 BPM -> beat 250 ms -> 25% = 62.5 ms (above the 60 ms floor).
    assert scoring.tolerance_for(rhythm.beat_ms(240)) == 62.5
    # Extremely fast hypothetical beat where the floor kicks in.
    assert scoring.tolerance_for(100.0) == 60.0
