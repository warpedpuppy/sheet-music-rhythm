"""Pure tap-to-onset matching and accuracy scoring."""

from dataclasses import dataclass, field

from ..config import settings
from . import rhythm


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
    extra_taps: list[float] = field(default_factory=list)
    accuracy: float = 0.0
    passed: bool = False
    tolerance_ms: float = 0.0


def tolerance_for(beat_ms: float) -> float:
    return max(settings.tolerance_min_ms, settings.tolerance_fraction * beat_ms)


def score_attempt(
    pattern: dict, time_signature: str, tempo_bpm: int, taps_ms: list[float]
) -> ScoreResult:
    onsets = rhythm.expected_onsets(pattern, time_signature, tempo_bpm)
    bms = rhythm.beat_ms(tempo_bpm)
    tolerance = tolerance_for(bms)
    hit_window = settings.hit_window_fraction * bms

    taps = sorted(taps_ms)
    used = [False] * len(taps)
    results: list[NoteScore] = []

    for i, onset in enumerate(onsets):
        best_j = None
        best_delta = None
        for j, tap in enumerate(taps):
            if used[j]:
                continue
            delta = tap - onset
            if abs(delta) <= tolerance and (best_delta is None or abs(delta) < abs(best_delta)):
                best_j = j
                best_delta = delta
        if best_j is None:
            results.append(NoteScore(index=i, expected_ms=onset, status="missed"))
            continue
        used[best_j] = True
        if abs(best_delta) <= hit_window:
            status, credit = "hit", 1.0
        elif best_delta < 0:
            status, credit = "early", 0.5
        else:
            status, credit = "late", 0.5
        results.append(
            NoteScore(
                index=i,
                expected_ms=onset,
                status=status,
                tap_ms=taps[best_j],
                delta_ms=best_delta,
                credit=credit,
            )
        )

    extra_taps = [tap for j, tap in enumerate(taps) if not used[j]]
    credits = sum(r.credit for r in results)
    penalty = settings.extra_tap_penalty * len(extra_taps)
    accuracy = max(0.0, credits - penalty) / len(onsets) if onsets else 0.0
    passed = accuracy >= settings.pass_threshold

    return ScoreResult(
        results=results,
        extra_taps=extra_taps,
        accuracy=round(accuracy, 4),
        passed=passed,
        tolerance_ms=tolerance,
    )
