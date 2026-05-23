import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Attempt, Exercise, User
from ..schemas import AttemptCreate, AttemptResult, NoteResult, Pattern
from ..services.progression import get_or_create_progress, record_attempt_outcome
from ..services.rhythm import expected_onsets
from ..services.scoring import score_taps

router = APIRouter(prefix="/api/exercises", tags=["attempts"])


@router.post("/{exercise_id}/attempts", response_model=AttemptResult, status_code=201)
def submit_attempt(
    exercise_id: int,
    payload: AttemptCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AttemptResult:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None or not exercise.is_active:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    progress = get_or_create_progress(db, user)
    if exercise.level > progress.unlocked_level and not user.is_admin:
        raise HTTPException(status_code=403, detail="This exercise is locked.")

    pattern = Pattern.model_validate(json.loads(exercise.pattern_json))
    onsets = expected_onsets(pattern)
    expected_beats = [beat for _, beat in onsets]

    if payload.gave_up:
        result = score_taps(expected_beats, [])
        passed = False
    else:
        taps = sorted(payload.taps_ms)
        result = score_taps(expected_beats, taps)
        passed = result.passed

    note_results = [
        NoteResult(
            index=n.index,
            expected_beat=n.expected_beat,
            actual_beat=n.actual_beat,
            deviation_beats=n.deviation_beats,
            verdict=n.verdict,
        )
        for n in result.note_results
    ]

    attempt = Attempt(
        user_id=user.id,
        exercise_id=exercise.id,
        taps_json=json.dumps(payload.taps_ms),
        results_json=json.dumps([n.model_dump() for n in note_results]),
        accuracy=result.accuracy,
        passed=passed,
        gave_up=payload.gave_up,
    )
    db.add(attempt)
    db.flush()

    summary = record_attempt_outcome(db, user, exercise, passed)
    db.commit()

    if payload.gave_up:
        base_message = "Attempt recorded. Listen to the correct rhythm and try again when you're ready."
    elif passed:
        base_message = "Nice — you tapped that rhythm correctly!"
    else:
        base_message = "Not quite. Compare your taps with the notation and try again."

    return AttemptResult(
        attempt_id=attempt.id,
        passed=passed,
        gave_up=payload.gave_up,
        accuracy=result.accuracy,
        note_results=note_results,
        inferred_bpm=result.inferred_bpm,
        unlocked_level=progress.unlocked_level,
        newly_unlocked_level=summary.newly_unlocked_level,
        remediation_started=summary.remediation_started,
        remediation_active=summary.remediation_active,
        message=(base_message + " " + summary.message).strip(),
    )
