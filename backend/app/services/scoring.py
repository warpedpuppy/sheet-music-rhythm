"""Free-tempo tap scoring.

The student taps at whatever speed feels natural, so absolute timing is meaningless.
Instead the first tap is anchored to the first expected note, the student's tempo is
inferred from the overall span of their taps, and each note is judged by how far (in
beats) the corresponding tap landed from where the notation says it should.
"""

from dataclasses import dataclass

# Verdict windows, in quarter-note beats of deviation from the expected onset.
ON_TIME_WINDOW = 0.25
CLOSE_WINDOW = 0.5

# Only on-time notes count toward accuracy; early/late/wrong/missed are shown to the
# student as feedback but earn no credit. Partial credit would let a student who taps
# an uneven rhythm perfectly evenly still pass, which defeats the exercise.
PASS_THRESHOLD = 0.8


@dataclass
class NoteScore:
    index: int
    expected_beat: float
    actual_beat: float | None
    deviation_beats: float | None
    verdict: str


@dataclass
class ScoreResult:
    note_results: list[NoteScore]
    accuracy: float
    passed: bool
    inferred_ms_per_beat: float | None

    @property
    def inferred_bpm(self) -> float | None:
        if not self.inferred_ms_per_beat:
            return None
        return 60000.0 / self.inferred_ms_per_beat


def _all_missed(expected_beats: list[float]) -> ScoreResult:
    notes = [
        NoteScore(index=i, expected_beat=b, actual_beat=None, deviation_beats=None, verdict="missed")
        for i, b in enumerate(expected_beats)
    ]
    return ScoreResult(note_results=notes, accuracy=0.0, passed=False, inferred_ms_per_beat=None)


def infer_ms_per_beat(expected_beats: list[float], taps_ms: list[float]) -> float | None:
    """Tempo implied by the full span of the performance: the time from the first to
    the last tap divided by the number of beats the notation says that span covers.

    A least-squares fit is deliberately NOT used here — it would pick whatever tempo
    makes the performance look best, which lets perfectly even tapping pass for an
    uneven rhythm.
    """
    n = min(len(expected_beats), len(taps_ms))
    if n < 2:
        return None
    beat_span = expected_beats[n - 1] - expected_beats[0]
    time_span = taps_ms[n - 1] - taps_ms[0]
    if beat_span <= 0 or time_span <= 0:
        return None
    return time_span / beat_span


def score_taps(expected_beats: list[float], taps_ms: list[float]) -> ScoreResult:
    """Score a list of tap timestamps (ms) against expected onset beats.

    Taps pair 1:1 with expected notes in order; unmatched trailing notes are missed
    and surplus taps are ignored.
    """
    if not expected_beats:
        return ScoreResult(note_results=[], accuracy=0.0, passed=False, inferred_ms_per_beat=None)
    if not taps_ms:
        return _all_missed(expected_beats)

    if len(expected_beats) == 1:
        note = NoteScore(
            index=0,
            expected_beat=expected_beats[0],
            actual_beat=expected_beats[0],
            deviation_beats=0.0,
            verdict="on_time",
        )
        return ScoreResult(note_results=[note], accuracy=1.0, passed=True, inferred_ms_per_beat=None)

    ms_per_beat = infer_ms_per_beat(expected_beats, taps_ms)
    b0, t0 = expected_beats[0], taps_ms[0]

    notes: list[NoteScore] = []
    for i, expected in enumerate(expected_beats):
        if i >= len(taps_ms):
            notes.append(
                NoteScore(index=i, expected_beat=expected, actual_beat=None, deviation_beats=None, verdict="missed")
            )
            continue
        if i == 0:
            notes.append(
                NoteScore(index=0, expected_beat=expected, actual_beat=expected, deviation_beats=0.0, verdict="on_time")
            )
            continue
        if ms_per_beat is None:
            notes.append(
                NoteScore(index=i, expected_beat=expected, actual_beat=None, deviation_beats=None, verdict="wrong")
            )
            continue
        actual = b0 + (taps_ms[i] - t0) / ms_per_beat
        deviation = actual - expected
        if abs(deviation) <= ON_TIME_WINDOW:
            verdict = "on_time"
        elif abs(deviation) <= CLOSE_WINDOW:
            verdict = "early" if deviation < 0 else "late"
        else:
            verdict = "wrong"
        notes.append(
            NoteScore(
                index=i,
                expected_beat=expected,
                actual_beat=round(actual, 4),
                deviation_beats=round(deviation, 4),
                verdict=verdict,
            )
        )

    accuracy = sum(1.0 for n in notes if n.verdict == "on_time") / len(notes)
    return ScoreResult(
        note_results=notes,
        accuracy=round(accuracy, 4),
        passed=accuracy >= PASS_THRESHOLD,
        inferred_ms_per_beat=ms_per_beat,
    )
