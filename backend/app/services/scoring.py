"""Tempo-free scoring: taps are matched to the notated rhythm at the user's own pace.

The first tap anchors the clock. A beat duration is fitted to the taps
(least squares against the notated beat positions), then each tap is graded by
how far it lands from its expected position at that fitted tempo.
"""

from dataclasses import dataclass, field

from ..config import settings
from . import rhythm

MIN_BEAT_MS = 250.0   # 240 BPM
MAX_BEAT_MS = 2000.0  # 30 BPM

# Beat lengths a played note can be quantized to, with their notation.
QUANTIZE_STEPS: list[tuple[float, str, int]] = [
    (0.25, "16", 0),
    (0.5, "8", 0),
    (0.75, "8", 1),
    (1.0, "q", 0),
    (1.5, "q", 1),
    (2.0, "h", 0),
    (3.0, "h", 1),
    (4.0, "w", 0),
]


@dataclass
class NoteScore:
    index: int
    expected_ms: float
    status: str  # hit | early | late | missed
    tap_ms: float | None = None
    delta_ms: float | None = None
    credit: float = 0.0


@dataclass
class ScoreResult:
    results: list[NoteScore] = field(default_factory=list)
    accuracy: float = 0.0
    passed: bool = False
    tolerance_ms: float = 0.0
    detected_tempo_bpm: int | None = None
    played_pattern: dict | None = None


def fit_beat_ms(positions: list[float], relative_taps: list[float]) -> float:
    """Least-squares fit of the user's beat duration to their paired taps."""
    numerator = 0.0
    denominator = 0.0
    for position, tap in zip(positions, relative_taps):
        if position > 0:
            numerator += position * tap
            denominator += position * position
    if denominator == 0:
        return MIN_BEAT_MS
    return min(MAX_BEAT_MS, max(MIN_BEAT_MS, numerator / denominator))


def quantize_taps_to_pattern(
    relative_taps: list[float], beat_ms: float, last_note_beats: float
) -> dict | None:
    """Render the user's taps as a simple pattern of quantized note values."""
    if not relative_taps:
        return None
    events = []
    for i, tap in enumerate(relative_taps):
        if i + 1 < len(relative_taps):
            gap_beats = (relative_taps[i + 1] - tap) / beat_ms
        else:
            gap_beats = last_note_beats
        beats, duration, dots = min(QUANTIZE_STEPS, key=lambda step: abs(step[0] - gap_beats))
        event: dict = {"type": "note", "duration": duration}
        if dots:
            event["dots"] = dots
        events.append(event)
    return {"events": events}


def score_attempt(pattern: dict, taps_ms: list[float]) -> ScoreResult:
    positions = rhythm.onset_beats(pattern)
    durations = rhythm.onset_durations_beats(pattern)
    n = len(positions)
    if n == 0:
        return ScoreResult()

    # The first tap is the time origin, so a leading rest carries no information:
    # measure every onset relative to the first one.
    positions = [p - positions[0] for p in positions]

    taps = sorted(taps_ms)[:n]
    relative = [tap - taps[0] for tap in taps] if taps else []

    if n == 1:
        beat = MIN_BEAT_MS
    else:
        beat = fit_beat_ms(positions[: len(relative)], relative)
    tolerance = max(settings.tolerance_min_ms, settings.tolerance_fraction * beat)
    hit_window = settings.hit_window_fraction * beat

    results: list[NoteScore] = []
    for i, position in enumerate(positions):
        expected_ms = position * beat
        if i >= len(relative):
            results.append(NoteScore(index=i, expected_ms=expected_ms, status="missed"))
            continue
        delta = relative[i] - expected_ms
        if abs(delta) <= hit_window:
            status, credit = "hit", 1.0
        elif abs(delta) <= tolerance:
            status, credit = ("early", 0.5) if delta < 0 else ("late", 0.5)
        else:
            status, credit = "missed", 0.0
        results.append(
            NoteScore(
                index=i,
                expected_ms=expected_ms,
                status=status,
                tap_ms=relative[i],
                delta_ms=delta,
                credit=credit,
            )
        )

    accuracy = sum(r.credit for r in results) / n
    passed = accuracy >= settings.pass_threshold
    last_note_beats = durations[len(relative) - 1] if relative and durations else 1.0

    return ScoreResult(
        results=results,
        accuracy=round(accuracy, 4),
        passed=passed,
        tolerance_ms=round(tolerance, 1),
        detected_tempo_bpm=round(60000.0 / beat) if len(relative) >= 2 else None,
        played_pattern=quantize_taps_to_pattern(relative, beat, last_note_beats),
    )
