from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Attempt, Exercise, User
from ..schemas import (
    AttemptIn,
    AttemptOut,
    AttemptSummary,
    NoteResult,
    ProgressionInfo,
)
from ..services import progression, scoring

router = APIRouter(prefix="/api/attempts", tags=["attempts"])


@router.post("", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
def submit_attempt(
    payload: AttemptIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exercise = db.get(Exercise, payload.exercise_id)
    if exercise is None or not exercise.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    if payload.gave_up:
        attempt = Attempt(
            user_id=user.id,
            exercise_id=exercise.id,
            taps=payload.taps_ms,
            results=None,
            accuracy=None,
            passed=False,
            gave_up=True,
        )
        db.add(attempt)
        update = progression.record_attempt_outcome(db, user, exercise, accuracy=None, passed=False)
        db.commit()
        db.refresh(attempt)
        return AttemptOut(
            attempt_id=attempt.id,
            gave_up=True,
            progression=ProgressionInfo(
                unlocked_level=update.unlocked_level,
                leveled_up=update.leveled_up,
                remediation_started=update.remediation_started,
                remediation_resolved=update.remediation_resolved,
                suggestion=update.suggestion,
            ),
        )

    score = scoring.score_attempt(exercise.pattern, payload.taps_ms)
    note_results = [
        NoteResult(
            index=r.index,
            expected_ms=r.expected_ms,
            status=r.status,
            tap_ms=r.tap_ms,
            delta_ms=r.delta_ms,
        )
        for r in score.results
    ]
    attempt = Attempt(
        user_id=user.id,
        exercise_id=exercise.id,
        taps=payload.taps_ms,
        results={
            "notes": [r.model_dump() for r in note_results],
            "detected_tempo_bpm": score.detected_tempo_bpm,
            "played_pattern": score.played_pattern,
        },
        accuracy=score.accuracy,
        passed=score.passed,
        gave_up=False,
    )
    db.add(attempt)
    update = progression.record_attempt_outcome(
        db, user, exercise, accuracy=score.accuracy, passed=score.passed
    )
    db.commit()
    db.refresh(attempt)

    return AttemptOut(
        attempt_id=attempt.id,
        gave_up=False,
        results=note_results,
        accuracy=score.accuracy,
        passed=score.passed,
        detected_tempo_bpm=score.detected_tempo_bpm,
        played_pattern=score.played_pattern,
        progression=ProgressionInfo(
            unlocked_level=update.unlocked_level,
            leveled_up=update.leveled_up,
            remediation_started=update.remediation_started,
            remediation_resolved=update.remediation_resolved,
            suggestion=update.suggestion,
        ),
    )


@router.get("", response_model=list[AttemptSummary])
def list_attempts(
    exercise_id: int | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Attempt).where(Attempt.user_id == user.id)
    if exercise_id is not None:
        query = query.where(Attempt.exercise_id == exercise_id)
    attempts = db.execute(
        query.order_by(Attempt.created_at.desc()).limit(min(limit, 100))
    ).scalars().all()
    return attempts
