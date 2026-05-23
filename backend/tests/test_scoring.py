import pytest

from app.services.scoring import infer_ms_per_beat, score_taps


def taps_at(beats: list[float], ms_per_beat: float = 600.0, offset: float = 1000.0) -> list[float]:
    return [offset + b * ms_per_beat for b in beats]


class TestInferMsPerBeat:
    def test_perfect_taps_recover_tempo(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        assert infer_ms_per_beat(beats, taps_at(beats, 500.0)) == pytest.approx(500.0)

    def test_uneven_spacing_still_recovers_tempo(self):
        beats = [0.0, 1.5, 2.0, 4.0]
        assert infer_ms_per_beat(beats, taps_at(beats, 750.0)) == pytest.approx(750.0)

    def test_single_tap_returns_none(self):
        assert infer_ms_per_beat([0.0], [100.0]) is None

    def test_zero_or_negative_slope_returns_none(self):
        assert infer_ms_per_beat([0.0, 1.0, 2.0], [500.0, 500.0, 500.0]) is None
        assert infer_ms_per_beat([0.0, 1.0, 2.0], [500.0, 400.0, 300.0]) is None


class TestScoreTaps:
    def test_perfect_performance_passes(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        result = score_taps(beats, taps_at(beats))
        assert result.passed is True
        assert result.accuracy == 1.0
        assert [n.verdict for n in result.note_results] == ["on_time"] * 4

    def test_tempo_independence(self):
        beats = [0.0, 1.0, 1.5, 2.0, 3.0]
        slow = score_taps(beats, taps_at(beats, 1200.0))
        fast = score_taps(beats, taps_at(beats, 250.0))
        assert slow.passed and fast.passed
        assert slow.accuracy == fast.accuracy == 1.0

    def test_inferred_bpm(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        result = score_taps(beats, taps_at(beats, 600.0))
        assert result.inferred_bpm == pytest.approx(100.0)

    def test_no_taps_means_all_missed(self):
        result = score_taps([0.0, 1.0, 2.0], [])
        assert result.passed is False
        assert result.accuracy == 0.0
        assert [n.verdict for n in result.note_results] == ["missed"] * 3

    def test_too_few_taps_marks_trailing_notes_missed(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        result = score_taps(beats, taps_at([0.0, 1.0]))
        verdicts = [n.verdict for n in result.note_results]
        assert verdicts[2:] == ["missed", "missed"]
        assert result.passed is False

    def test_one_late_note_detected(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        taps = taps_at([0.0, 1.0, 2.4, 3.0])
        result = score_taps(beats, taps)
        assert result.note_results[2].verdict == "late"

    def test_one_early_note_detected(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        taps = taps_at([0.0, 1.0, 1.6, 3.0])
        result = score_taps(beats, taps)
        assert result.note_results[2].verdict == "early"

    def test_wildly_wrong_rhythm_fails(self):
        beats = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0]
        # Tap everything evenly when the notation is not even.
        result = score_taps(beats, taps_at([0.0, 1.0, 2.0, 3.0, 4.0, 5.0]))
        assert result.passed is False

    def test_first_tap_is_always_anchored_on_time(self):
        beats = [0.0, 1.0, 2.0]
        result = score_taps(beats, taps_at(beats, 500.0, offset=98765.0))
        assert result.note_results[0].verdict == "on_time"

    def test_single_note_pattern_auto_passes(self):
        result = score_taps([0.0], [42.0])
        assert result.passed is True
        assert result.accuracy == 1.0

    def test_empty_expected_beats(self):
        result = score_taps([], [1.0, 2.0])
        assert result.passed is False
        assert result.note_results == []

    def test_one_off_note_in_five_just_passes(self):
        beats = [0.0, 1.0, 2.0, 3.0, 4.0]
        taps = taps_at([0.0, 1.0, 2.0, 3.4, 4.0])
        result = score_taps(beats, taps)
        late = [n for n in result.note_results if n.verdict in ("early", "late")]
        assert len(late) == 1
        assert result.accuracy == pytest.approx(0.8)
        assert result.passed is True

    def test_dotted_rhythm_tapped_evenly_fails(self):
        # Dotted-quarter + eighth pattern tapped as straight quarters: the student
        # ignored the dot, so this must not pass.
        beats = [0.0, 1.5, 2.0, 3.0]
        result = score_taps(beats, taps_at([0.0, 1.0, 2.0, 3.0]))
        assert result.passed is False
