"""Pure rhythm math: pattern validation and expected-onset computation.

All times are in milliseconds. Taps are submitted relative to the first
count-in click; the count-in is one full measure, so expected onsets are
offset by count_in_ms.
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


def count_in_ms(time_signature: str, tempo_bpm: int) -> float:
    return beats_per_measure(time_signature) * beat_ms(tempo_bpm)


def expected_onsets(pattern: dict, time_signature: str, tempo_bpm: int) -> list[float]:
    """Onset times (ms, relative to the first count-in click) the user must tap.

    Rests and tied-into notes consume time but produce no onset.
    """
    bms = beat_ms(tempo_bpm)
    t = count_in_ms(time_signature, tempo_bpm)
    onsets: list[float] = []
    tied_into = False
    for event in pattern.get("events", []):
        if event.get("type") == "note" and not tied_into:
            onsets.append(t)
        t += event_beats(event) * bms
        tied_into = bool(event.get("tieToNext")) and event.get("type") == "note"
    return onsets


def total_duration_ms(pattern: dict, time_signature: str, tempo_bpm: int) -> float:
    """Length of the exercise (count-in + all events), in ms."""
    bms = beat_ms(tempo_bpm)
    events_ms = sum(event_beats(e) for e in pattern.get("events", [])) * bms
    return count_in_ms(time_signature, tempo_bpm) + events_ms
