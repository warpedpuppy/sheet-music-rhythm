"""Pure rhythm math: pattern validation and onset computation.

Onsets are expressed in beats (quarter-note units) starting at 0. There is no
metronome or count-in: the user taps at their own tempo, and scoring fits a
beat duration to their taps.
"""

DURATION_BEATS = {"w": 4.0, "h": 2.0, "q": 1.0, "8": 0.5, "16": 0.25}


def parse_time_signature(time_signature: str) -> tuple[int, int]:
    try:
        num, denom = time_signature.split("/")
        return int(num), int(denom)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid time signature: {time_signature!r}")


def beats_per_measure(time_signature: str) -> float:
    """Beats per measure expressed in quarter notes."""
    num, denom = parse_time_signature(time_signature)
    return num * (4.0 / denom)


def event_beats(event: dict) -> float:
    duration = event.get("duration")
    if duration not in DURATION_BEATS:
        raise ValueError(f"Invalid duration: {duration!r}")
    beats = DURATION_BEATS[duration]
    if event.get("dots", 0) == 1:
        beats *= 1.5
    return beats


def validate_pattern(pattern: dict, time_signature: str, num_measures: int) -> None:
    """Raise ValueError if the pattern's total beats don't fill the measures exactly."""
    events = pattern.get("events", [])
    if not events:
        raise ValueError("Pattern must contain at least one event")
    total = sum(event_beats(e) for e in events)
    expected = beats_per_measure(time_signature) * num_measures
    if abs(total - expected) > 1e-6:
        raise ValueError(
            f"Pattern total of {total} beats does not fill {num_measures} measures "
            f"of {time_signature} ({expected} beats)"
        )
    if not any(e.get("type") == "note" for e in events):
        raise ValueError("Pattern must contain at least one note")
    last = events[-1]
    if last.get("tieToNext"):
        raise ValueError("Last event cannot be tied to a following note")
    for i, e in enumerate(events):
        if e.get("tieToNext"):
            if e.get("type") != "note":
                raise ValueError("Only notes can be tied")
            if events[i + 1].get("type") != "note":
                raise ValueError("A tie must connect two notes")


def beat_ms(tempo_bpm: int) -> float:
    return 60000.0 / tempo_bpm


def onset_beats(pattern: dict) -> list[float]:
    """Beat positions (starting at 0) of every event the user must tap.

    Rests and tied-into notes consume time but produce no onset.
    """
    t = 0.0
    onsets: list[float] = []
    tied_into = False
    for event in pattern.get("events", []):
        if event.get("type") == "note" and not tied_into:
            onsets.append(t)
        t += event_beats(event)
        tied_into = bool(event.get("tieToNext")) and event.get("type") == "note"
    return onsets


def onset_durations_beats(pattern: dict) -> list[float]:
    """For each onset, the notated length in beats (ties included)."""
    durations: list[float] = []
    tied_into = False
    for event in pattern.get("events", []):
        if event.get("type") == "note" and not tied_into:
            durations.append(event_beats(event))
        elif event.get("type") == "note" and tied_into and durations:
            durations[-1] += event_beats(event)
        tied_into = bool(event.get("tieToNext")) and event.get("type") == "note"
    return durations
