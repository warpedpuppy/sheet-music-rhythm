from app.services import scoring
from .conftest import make_pattern, note, rest

# Four quarter notes: relative beat positions 0, 1, 2, 3.
QUARTERS = make_pattern(*[note("q")] * 4)
# Dotted quarter + eighth + half: positions 0, 1.5, 2.
DOTTED = make_pattern(note("q", dots=1), note("8"), note("h"))


def taps_at(beat_ms, positions, start=10000.0):
    return [start + p * beat_ms for p in positions]


def test_correct_ratios_pass_at_a_slow_tempo():
    result = scoring.score_attempt(QUARTERS, taps_at(900, [0, 1, 2, 3]))
    assert [r.status for r in result.results] == ["hit"] * 4
    assert result.accuracy == 1.0
    assert result.passed is True
    assert result.detected_tempo_bpm == round(60000 / 900)


def test_correct_ratios_pass_at_a_fast_tempo():
    result = scoring.score_attempt(QUARTERS, taps_at(400, [0, 1, 2, 3]))
    assert result.accuracy == 1.0
    assert result.passed is True
    assert result.detected_tempo_bpm == 150


def test_dotted_rhythm_with_correct_ratios_passes():
    result = scoring.score_attempt(DOTTED, taps_at(800, [0, 1.5, 2]))
    assert [r.status for r in result.results] == ["hit"] * 3
    assert result.passed is True


def test_even_taps_for_a_dotted_rhythm_fail():
    # User taps three evenly spaced notes for a dotted-quarter / eighth / half figure.
    result = scoring.score_attempt(DOTTED, taps_at(800, [0, 1, 2]))
    assert result.results[0].status == "hit"
    assert result.results[1].status != "hit"
    assert result.passed is False


def test_slightly_uneven_taps_get_partial_credit():
    result = scoring.score_attempt(QUARTERS, taps_at(800, [0, 1.18, 2, 3]))
    statuses = [r.status for r in result.results]
    assert statuses[0] == "hit"
    assert statuses[1] in ("late", "early")
    assert 0 < result.accuracy < 1


def test_missing_taps_are_marked_missed():
    result = scoring.score_attempt(QUARTERS, taps_at(800, [0, 1]))
    assert [r.status for r in result.results] == ["hit", "hit", "missed", "missed"]
    assert result.accuracy == 0.5
    assert result.passed is False


def test_no_taps_scores_zero():
    result = scoring.score_attempt(QUARTERS, [])
    assert all(r.status == "missed" for r in result.results)
    assert result.accuracy == 0.0
    assert result.played_pattern is None
    assert result.detected_tempo_bpm is None


def test_rests_lengthen_the_gap_but_are_not_tapped():
    pattern = make_pattern(note("q"), rest("q"), note("q"), note("q"))
    # Onsets at beats 0, 2, 3 -> taps with a double gap in the middle.
    result = scoring.score_attempt(pattern, taps_at(700, [0, 2, 3]))
    assert len(result.results) == 3
    assert result.accuracy == 1.0


def test_leading_rest_is_ignored_for_anchoring():
    pattern = make_pattern(rest("8"), note("8"), note("q"), note("q"), note("q"), note("8"))
    # Onsets land at beats 0.5, 1, 2, 3, 4; anchored to the first onset that is 0, 0.5, 1.5, 2.5, 3.5.
    result = scoring.score_attempt(pattern, taps_at(600, [0, 0.5, 1.5, 2.5, 3.5]))
    assert all(r.status == "hit" for r in result.results)
    assert result.passed is True


def test_single_note_pattern_any_tap_is_a_hit():
    pattern = make_pattern(note("w"))
    result = scoring.score_attempt(pattern, [123456.0])
    assert result.results[0].status == "hit"
    assert result.accuracy == 1.0
    assert result.detected_tempo_bpm is None


def test_spammed_taps_do_not_pass():
    result = scoring.score_attempt(QUARTERS, [1000.0, 1030.0, 1060.0, 1090.0])
    assert result.passed is False


def test_played_pattern_quantizes_taps():
    # Quarter, quarter, half feel at 500 ms per beat.
    pattern = make_pattern(note("q"), note("q"), note("h"))
    result = scoring.score_attempt(pattern, taps_at(500, [0, 1, 2]))
    events = result.played_pattern["events"]
    assert [e["duration"] for e in events] == ["q", "q", "h"]
    assert all(e["type"] == "note" for e in events)


def test_played_pattern_reflects_what_was_actually_tapped():
    # The notation is four quarters but the user plays quarter, dotted-quarter, eighth, quarter.
    result = scoring.score_attempt(QUARTERS, taps_at(600, [0, 1, 2.5, 3]))
    events = result.played_pattern["events"]
    assert events[1] == {"type": "note", "duration": "q", "dots": 1}
    assert events[2]["duration"] == "8"


def test_fit_beat_is_clamped_to_a_sane_range():
    assert scoring.fit_beat_ms([0, 1, 2, 3], [0, 50, 100, 150]) == scoring.MIN_BEAT_MS
    assert scoring.fit_beat_ms([0, 1, 2, 3], [0, 5000, 10000, 15000]) == scoring.MAX_BEAT_MS
