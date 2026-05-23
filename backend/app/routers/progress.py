from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Attempt, ConceptMastery, Exercise, User
from ..schemas import ConceptMasteryOut, NextExerciseOut, ProgressSummary
from ..services.progression import (
    MASTERY_PASSES,
    active_remediation,
    get_or_create_progress,
    max_level,
    next_exercise,
    passed_exercise_ids,
)

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=ProgressSummary)
def get_progress(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProgressSummary:
    progress = get_or_create_progress(db, user)
    db.commit()
    total_attempts = db.execute(
        select(func.count(Attempt.id)).where(Attempt.user_id == user.id)
    ).scalar() or 0
    total_exercises = db.execute(
        select(func.count(Exercise.id)).where(Exercise.is_active.is_(True))
    ).scalar() or 0
    masteries = db.execute(
        select(ConceptMastery).where(ConceptMastery.user_id == user.id)
    ).scalars().all()
    remediation = active_remediation(db, user.id)
    return ProgressSummary(
        unlocked_level=progress.unlocked_level,
        max_level=max_level(db),
        total_attempts=total_attempts,
        total_passed_exercises=len(passed_exercise_ids(db, user.id)),
        total_exercises=total_exercises,
        concepts=[
            ConceptMasteryOut(
                concept=m.concept,
                passes=m.passes,
                fails=m.fails,
                mastered=m.passes >= MASTERY_PASSES,
            )
            for m in masteries
        ],
        remediation_active=remediation is not None,
        remediation_concept=remediation.concept if remediation else None,
    )


@router.get("/next", response_model=NextExerciseOut)
def get_next_exercise(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NextExerciseOut:
    exercise, reason, message = next_exercise(db, user)
    db.commit()
    return NextExerciseOut(
        exercise_id=exercise.id if exercise else None,
        title=exercise.title if exercise else None,
        level=exercise.level if exercise else None,
        reason=reason,
        message=message,
    )
