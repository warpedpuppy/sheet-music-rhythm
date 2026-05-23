import pytest

from app.services.scoring import infer_ms_per_beat, score_taps, score_taps_strict


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


class TestScoreTapsStrict:
    MS_PER_BEAT = 600.0

    def grid(self, beats):
        return [b * self.MS_PER_BEAT for b in beats]

    def test_on_grid_taps_pass(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        result = score_taps_strict(beats, self.grid(beats), self.MS_PER_BEAT)
        assert result.passed is True
        assert result.accuracy == 1.0
        assert [n.verdict for n in result.note_results] == ["on_time"] * 4

    def test_correct_proportions_at_the_wrong_tempo_fail(self):
        # The whole point of strict mode: a perfect rhythm at half the metronome's
        # speed must fail, even though free-tempo scoring would pass it.
        beats = [0.0, 1.0, 2.0, 3.0]
        slow_taps = [b * self.MS_PER_BEAT * 2 for b in beats]
        assert score_taps(beats, slow_taps).passed is True
        assert score_taps_strict(beats, slow_taps, self.MS_PER_BEAT).passed is False

    def test_first_note_is_not_anchored(self):
        # Starting half a beat late is penalised on the first note itself.
        beats = [0.0, 1.0, 2.0]
        taps = [0.4 * self.MS_PER_BEAT, 1.0 * self.MS_PER_BEAT, 2.0 * self.MS_PER_BEAT]
        result = score_taps_strict(beats, taps, self.MS_PER_BEAT)
        assert result.note_results[0].verdict == "late"

    def test_early_tap_before_the_downbeat_is_marked_early(self):
        beats = [0.0, 1.0, 2.0]
        taps = [-0.4 * self.MS_PER_BEAT, 1.0 * self.MS_PER_BEAT, 2.0 * self.MS_PER_BEAT]
        result = score_taps_strict(beats, taps, self.MS_PER_BEAT)
        assert result.note_results[0].verdict == "early"

    def test_offset_pattern_is_respected(self):
        # A pattern that starts with a rest expects its first tap on beat 1, not 0.
        beats = [1.0, 2.0, 3.0]
        result = score_taps_strict(beats, self.grid(beats), self.MS_PER_BEAT)
        assert result.passed is True
        result = score_taps_strict(beats, self.grid([0.0, 1.0, 2.0]), self.MS_PER_BEAT)
        assert result.passed is False

    def test_missing_taps_are_missed(self):
        beats = [0.0, 1.0, 2.0, 3.0]
        result = score_taps_strict(beats, self.grid([0.0, 1.0]), self.MS_PER_BEAT)
        assert [n.verdict for n in result.note_results[2:]] == ["missed", "missed"]
        assert result.passed is False

    def test_no_taps_all_missed(self):
        result = score_taps_strict([0.0, 1.0], [], self.MS_PER_BEAT)
        assert result.accuracy == 0.0
        assert result.inferred_ms_per_beat == self.MS_PER_BEAT

    def test_single_note_must_still_land_on_the_beat(self):
        # Free mode auto-passes single-note patterns; strict mode does not.
        on_time = score_taps_strict([0.0], [0.0], self.MS_PER_BEAT)
        assert on_time.passed is True
        late = score_taps_strict([0.0], [self.MS_PER_BEAT], self.MS_PER_BEAT)
        assert late.passed is False

    def test_reports_the_metronome_tempo(self):
        result = score_taps_strict([0.0, 1.0], self.grid([0.0, 1.0]), self.MS_PER_BEAT)
        assert result.inferred_bpm == pytest.approx(100.0)
