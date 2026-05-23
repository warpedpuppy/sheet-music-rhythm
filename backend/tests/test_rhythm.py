import pytest

from app.schemas import Pattern
from app.services.rhythm import (
    PatternError,
    event_beats,
    expected_onsets,
    measure_beats,
    onset_durations,
    tap_count,
    total_beats,
    validate_pattern,
)


def pattern(*events) -> Pattern:
    return Pattern.model_validate({"events": list(events)})


def note(duration, dots=0, tie=False):
    return {"type": "note", "duration": duration, "dots": dots, "tieToNext": tie}


def rest(duration, dots=0):
    return {"type": "rest", "duration": duration, "dots": dots}


class TestEventBeats:
    def test_basic_durations(self):
        assert event_beats(pattern(note("w")).events[0]) == 4.0
        assert event_beats(pattern(note("h")).events[0]) == 2.0
        assert event_beats(pattern(note("q")).events[0]) == 1.0
        assert event_beats(pattern(note("8")).events[0]) == 0.5
        assert event_beats(pattern(note("16")).events[0]) == 0.25

    def test_dot_extends_by_half(self):
        assert event_beats(pattern(note("q", dots=1)).events[0]) == 1.5
        assert event_beats(pattern(note("h", dots=1)).events[0]) == 3.0

    def test_measure_beats(self):
        assert measure_beats(4, 4) == 4.0
        assert measure_beats(3, 4) == 3.0
        assert measure_beats(6, 8) == 3.0
        assert measure_beats(2, 2) == 4.0


class TestValidatePattern:
    def test_exact_fill_passes(self):
        validate_pattern(pattern(note("q"), note("q"), note("h")), 4, 4, 1)

    def test_overfilled_raises(self):
        with pytest.raises(PatternError, match="require"):
            validate_pattern(pattern(note("h"), note("h"), note("q")), 4, 4, 1)

    def test_underfilled_raises(self):
        with pytest.raises(PatternError, match="require"):
            validate_pattern(pattern(note("q"), note("q")), 4, 4, 1)

    def test_multiple_measures(self):
        validate_pattern(pattern(note("w"), note("w")), 4, 4, 2)

    def test_three_four_time(self):
        validate_pattern(pattern(note("q"), note("q"), note("q")), 3, 4, 1)

    def test_tie_to_rest_raises(self):
        with pytest.raises(PatternError, match="tied to a rest"):
            validate_pattern(pattern(note("q", tie=True), rest("q"), note("h")), 4, 4, 1)

    def test_tie_on_last_event_raises(self):
        with pytest.raises(PatternError, match="last event"):
            validate_pattern(pattern(note("h"), note("h", tie=True)), 4, 4, 1)

    def test_all_rests_raises(self):
        with pytest.raises(PatternError, match="at least one note"):
            validate_pattern(pattern(rest("w")), 4, 4, 1)


class TestExpectedOnsets:
    def test_simple_quarters(self):
        onsets = expected_onsets(pattern(note("q"), note("q"), note("q"), note("q")))
        assert onsets == [(0, 0.0), (1, 1.0), (2, 2.0), (3, 3.0)]

    def test_rests_advance_time_without_onsets(self):
        onsets = expected_onsets(pattern(note("q"), rest("q"), note("h")))
        assert onsets == [(0, 0.0), (2, 2.0)]

    def test_leading_rest_offsets_first_onset(self):
        onsets = expected_onsets(pattern(rest("q"), note("q"), note("h")))
        assert onsets == [(1, 1.0), (2, 2.0)]

    def test_tied_note_is_not_tapped(self):
        onsets = expected_onsets(
            pattern(note("q"), note("q", tie=True), note("q"), note("q"))
        )
        assert onsets == [(0, 0.0), (1, 1.0), (3, 3.0)]

    def test_dotted_notes_shift_following_onsets(self):
        onsets = expected_onsets(pattern(note("q", dots=1), note("8"), note("h")))
        assert onsets == [(0, 0.0), (1, 1.5), (2, 2.0)]

    def test_tap_count(self):
        assert tap_count(pattern(note("q"), rest("q"), note("q", tie=True), note("q"))) == 2


class TestOnsetDurations:
    def test_durations_span_to_next_onset(self):
        durations = onset_durations(pattern(note("q"), rest("q"), note("h")))
        # First note sounds for 1 beat but the next tap is 2 beats later (rest absorbs 1).
        assert durations == [2.0, 2.0]

    def test_tie_extends_duration(self):
        durations = onset_durations(pattern(note("q", tie=True), note("q"), note("h")))
        assert durations == [2.0, 2.0]

    def test_total_beats(self):
        assert total_beats(pattern(note("q", dots=1), note("8"), note("h"))) == 4.0
