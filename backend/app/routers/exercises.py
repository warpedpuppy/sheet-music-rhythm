from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Exercise, User, UserExerciseProgress
from ..schemas import ExerciseOut, UserExerciseStatus

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def exercise_to_out(exercise: Exercise, user_status: UserExerciseStatus | None = None) -> ExerciseOut:
    out = ExerciseOut.model_validate(exercise)
    out.user_status = user_status
    return out


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    difficulty: int | None = None,
    concept: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Exercise).where(Exercise.is_active == True)  # noqa: E712
    if difficulty is not None:
        query = query.where(Exercise.difficulty == difficulty)
    exercises = db.execute(query.order_by(Exercise.difficulty, Exercise.id)).scalars().all()
    if concept is not None:
        exercises = [e for e in exercises if concept in (e.concept_tags or [])]

    progress_rows = db.execute(
        select(UserExerciseProgress).where(UserExerciseProgress.user_id == user.id)
    ).scalars().all()
    progress_by_exercise = {p.exercise_id: p for p in progress_rows}

    results = []
    for exercise in exercises:
        progress = progress_by_exercise.get(exercise.id)
        user_status = UserExerciseStatus(
            passed=progress.passed if progress else False,
            best_accuracy=progress.best_accuracy if progress else None,
            attempts_count=progress.attempts_count if progress else 0,
            locked=exercise.difficulty > user.unlocked_level,
        )
        results.append(exercise_to_out(exercise, user_status))
    return results


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exercise = db.get(Exercise, exercise_id)
    if exercise is None or not exercise.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")
    progress = db.execute(
        select(UserExerciseProgress).where(
            UserExerciseProgress.user_id == user.id,
            UserExerciseProgress.exercise_id == exercise.id,
        )
    ).scalar_one_or_none()
    user_status = UserExerciseStatus(
        passed=progress.passed if progress else False,
        best_accuracy=progress.best_accuracy if progress else None,
        attempts_count=progress.attempts_count if progress else 0,
        locked=exercise.difficulty > user.unlocked_level,
    )
    return exercise_to_out(exercise, user_status)
