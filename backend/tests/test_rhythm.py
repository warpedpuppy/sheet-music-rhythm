import pytest

from app.services import rhythm
from .conftest import make_pattern, note, rest


def test_event_beats_basic_durations():
    assert rhythm.event_beats(note("w")) == 4.0
    assert rhythm.event_beats(note("h")) == 2.0
    assert rhythm.event_beats(note("q")) == 1.0
    assert rhythm.event_beats(note("8")) == 0.5
    assert rhythm.event_beats(note("16")) == 0.25


def test_event_beats_dotted():
    assert rhythm.event_beats(note("q", dots=1)) == 1.5
    assert rhythm.event_beats(note("h", dots=1)) == 3.0


def test_beats_per_measure():
    assert rhythm.beats_per_measure("4/4") == 4.0
    assert rhythm.beats_per_measure("3/4") == 3.0
    assert rhythm.beats_per_measure("2/4") == 2.0
    assert rhythm.beats_per_measure("6/8") == 3.0


def test_validate_pattern_accepts_full_measures():
    pattern = make_pattern(*[note("q")] * 8)
    rhythm.validate_pattern(pattern, "4/4", 2)


def test_validate_pattern_rejects_wrong_total():
    pattern = make_pattern(*[note("q")] * 7)
    with pytest.raises(ValueError):
        rhythm.validate_pattern(pattern, "4/4", 2)


def test_validate_pattern_rejects_empty_and_all_rests():
    with pytest.raises(ValueError):
        rhythm.validate_pattern(make_pattern(), "4/4", 1)
    with pytest.raises(ValueError):
        rhythm.validate_pattern(make_pattern(rest("w")), "4/4", 1)


def test_validate_pattern_rejects_trailing_tie():
    pattern = make_pattern(note("h"), note("h", tie=True))
    with pytest.raises(ValueError):
        rhythm.validate_pattern(pattern, "4/4", 1)


def test_validate_pattern_rejects_tie_into_rest():
    pattern = make_pattern(note("h", tie=True), rest("h"))
    with pytest.raises(ValueError):
        rhythm.validate_pattern(pattern, "4/4", 1)


def test_onset_beats_simple_quarters():
    pattern = make_pattern(*[note("q")] * 4)
    assert rhythm.onset_beats(pattern) == [0.0, 1.0, 2.0, 3.0]


def test_onset_beats_skips_rests():
    pattern = make_pattern(note("q"), rest("q"), note("h"))
    assert rhythm.onset_beats(pattern) == [0.0, 2.0]


def test_onset_beats_leading_rest_offsets_first_onset():
    pattern = make_pattern(rest("8"), note("8"), note("q"), note("h"))
    assert rhythm.onset_beats(pattern) == [0.5, 1.0, 2.0]


def test_onset_beats_dotted_note():
    pattern = make_pattern(note("q", dots=1), note("8"), note("h"))
    assert rhythm.onset_beats(pattern) == [0.0, 1.5, 2.0]


def test_onset_beats_tied_note_produces_no_onset():
    pattern = make_pattern(note("q"), note("q", tie=True), note("q"), note("q"))
    # Second quarter ties into the third: only 3 onsets, third note absorbed.
    assert rhythm.onset_beats(pattern) == [0.0, 1.0, 3.0]


def test_onset_durations_include_tied_notes():
    pattern = make_pattern(note("q"), note("q", tie=True), note("q"), note("q"))
    assert rhythm.onset_durations_beats(pattern) == [1.0, 2.0, 1.0]


def test_beat_ms():
    assert rhythm.beat_ms(60) == 1000.0
    assert rhythm.beat_ms(120) == 500.0
