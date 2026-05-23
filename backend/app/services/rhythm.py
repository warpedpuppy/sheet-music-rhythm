"""Pure rhythm-pattern math: validation and expected tap onsets.

All beat values are expressed in quarter-note beats. Every supported duration is an
exact binary fraction, so float sums are exact; a tiny epsilon is still used when
comparing totals for robustness.
"""

from ..schemas import Pattern, PatternEvent

DURATION_BEATS: dict[str, float] = {
    "w": 4.0,
    "h": 2.0,
    "q": 1.0,
    "8": 0.5,
    "16": 0.25,
}

EPSILON = 1e-9


class PatternError(ValueError):
    pass


def event_beats(event: PatternEvent) -> float:
    beats = DURATION_BEATS[event.duration]
    if event.dots:
        beats *= 1.5
    return beats


def measure_beats(time_sig_top: int, time_sig_bottom: int) -> float:
    return time_sig_top * (4.0 / time_sig_bottom)


def total_beats(pattern: Pattern) -> float:
    return sum(event_beats(e) for e in pattern.events)


def validate_pattern(
    pattern: Pattern, time_sig_top: int, time_sig_bottom: int, num_measures: int
) -> None:
    """Raise PatternError if the pattern is malformed or does not exactly fill
    ``num_measures`` of the given time signature."""
    events = pattern.events
    for i, event in enumerate(events):
        if event.tieToNext:
            if event.type != "note":
                raise PatternError(f"Event {i + 1}: only notes can be tied.")
            if i == len(events) - 1:
                raise PatternError("The last event cannot be tied to a next note.")
            if events[i + 1].type != "note":
                raise PatternError(f"Event {i + 1}: a note cannot be tied to a rest.")

    expected = measure_beats(time_sig_top, time_sig_bottom) * num_measures
    actual = total_beats(pattern)
    if abs(actual - expected) > EPSILON:
        raise PatternError(
            f"Pattern fills {actual:g} beats but {num_measures} measure(s) of "
            f"{time_sig_top}/{time_sig_bottom} require {expected:g} beats."
        )

    if not any(e.type == "note" for e in events):
        raise PatternError("Pattern must contain at least one note.")


def expected_onsets(pattern: Pattern) -> list[tuple[int, float]]:
    """Return ``(event_index, beat_position)`` for every note the student must tap.

    A note is tappable unless it is the continuation of a tie from the previous
    event. Rests advance time but are never tapped.
    """
    onsets: list[tuple[int, float]] = []
    position = 0.0
    tied_from_previous = False
    for i, event in enumerate(pattern.events):
        if event.type == "note" and not tied_from_previous:
            onsets.append((i, position))
        position += event_beats(event)
        tied_from_previous = event.type == "note" and event.tieToNext
    return onsets


def tap_count(pattern: Pattern) -> int:
    return len(expected_onsets(pattern))


def onset_durations(pattern: Pattern) -> list[float]:
    """Beat duration each tapped note sounds for (tied continuations included),
    used to render the played-back rhythm and the give-up tick schedule."""
    onsets = expected_onsets(pattern)
    total = total_beats(pattern)
    durations = []
    for idx, (_, beat) in enumerate(onsets):
        end = onsets[idx + 1][1] if idx + 1 < len(onsets) else total
        durations.append(end - beat)
    return durations
