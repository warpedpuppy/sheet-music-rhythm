import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Attempt, ConceptMastery, Exercise, User, UserProgress
from ..schemas import (
    AdminAttemptOut,
    AdminUserDetail,
    AdminUserOut,
    ConceptMasteryOut,
    ExerciseCreate,
    ExerciseOut,
    ExerciseUpdate,
    TestRunRequest,
    TestRunStatus,
)
from ..services import test_runner
from ..services.progression import MASTERY_PASSES, passed_exercise_ids
from ..services.rhythm import PatternError, validate_pattern
from .exercises import exercise_to_out

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def _user_stats(db: Session, user: User) -> tuple[int, int, int]:
    progress = db.get(UserProgress, user.id)
    unlocked = progress.unlocked_level if progress else 1
    total_attempts = db.execute(
        select(func.count(Attempt.id)).where(Attempt.user_id == user.id)
    ).scalar() or 0
    passed = len(passed_exercise_ids(db, user.id))
    return unlocked, total_attempts, passed


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db)) -> list[AdminUserOut]:
    users = db.execute(select(User).order_by(User.id.asc())).scalars().all()
    out = []
    for user in users:
        unlocked, total_attempts, passed = _user_stats(db, user)
        out.append(
            AdminUserOut(
                id=user.id,
                username=user.username,
                is_admin=user.is_admin,
                created_at=user.created_at,
                unlocked_level=unlocked,
                total_attempts=total_attempts,
                passed_exercises=passed,
            )
        )
    return out


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user(user_id: int, db: Session = Depends(get_db)) -> AdminUserDetail:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    unlocked, total_attempts, passed = _user_stats(db, user)
    masteries = db.execute(
        select(ConceptMastery).where(ConceptMastery.user_id == user.id)
    ).scalars().all()
    attempts = db.execute(
        select(Attempt, Exercise.title)
        .join(Exercise, Exercise.id == Attempt.exercise_id)
        .where(Attempt.user_id == user.id)
        .order_by(Attempt.id.desc())
        .limit(20)
    ).all()
    return AdminUserDetail(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        created_at=user.created_at,
        unlocked_level=unlocked,
        total_attempts=total_attempts,
        passed_exercises=passed,
        concepts=[
            ConceptMasteryOut(
                concept=m.concept,
                passes=m.passes,
                fails=m.fails,
                mastered=m.passes >= MASTERY_PASSES,
            )
            for m in masteries
        ],
        recent_attempts=[
            AdminAttemptOut(
                id=a.id,
                exercise_id=a.exercise_id,
                exercise_title=title,
                accuracy=a.accuracy,
                passed=a.passed,
                gave_up=a.gave_up,
                created_at=a.created_at,
            )
            for a, title in attempts
        ],
    )


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------


@router.get("/exercises", response_model=list[ExerciseOut])
def list_all_exercises(db: Session = Depends(get_db)) -> list[ExerciseOut]:
    exercises = db.execute(
        select(Exercise).order_by(Exercise.level.asc(), Exercise.id.asc())
    ).scalars().all()
    return [exercise_to_out(e) for e in exercises]


def _validate_or_400(payload: ExerciseCreate | ExerciseUpdate) -> None:
    try:
        validate_pattern(
            payload.pattern, payload.time_sig_top, payload.time_sig_bottom, payload.num_measures
        )
    except PatternError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/exercises", response_model=ExerciseOut, status_code=201)
def create_exercise(payload: ExerciseCreate, db: Session = Depends(get_db)) -> ExerciseOut:
    _validate_or_400(payload)
    exercise = Exercise(
        title=payload.title,
        description=payload.description,
        level=payload.level,
        concept=payload.concept,
        learn_section=payload.learn_section,
        time_sig_top=payload.time_sig_top,
        time_sig_bottom=payload.time_sig_bottom,
        num_measures=payload.num_measures,
        tempo_bpm=payload.tempo_bpm,
        pattern_json=payload.pattern.model_dump_json(),
        is_active=True,
    )
    db.add(exercise)
    db.commit()
    return exercise_to_out(exercise)


@router.put("/exercises/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    exercise_id: int, payload: ExerciseUpdate, db: Session = Depends(get_db)
) -> ExerciseOut:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    _validate_or_400(payload)
    exercise.title = payload.title
    exercise.description = payload.description
    exercise.level = payload.level
    exercise.concept = payload.concept
    exercise.learn_section = payload.learn_section
    exercise.time_sig_top = payload.time_sig_top
    exercise.time_sig_bottom = payload.time_sig_bottom
    exercise.num_measures = payload.num_measures
    exercise.tempo_bpm = payload.tempo_bpm
    exercise.pattern_json = payload.pattern.model_dump_json()
    exercise.is_active = payload.is_active
    db.commit()
    return exercise_to_out(exercise)


@router.delete("/exercises/{exercise_id}", status_code=204)
def deactivate_exercise(exercise_id: int, db: Session = Depends(get_db)) -> None:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    exercise.is_active = False
    db.commit()


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------


@router.post("/tests/run", response_model=TestRunStatus, status_code=202)
def run_tests(payload: TestRunRequest) -> TestRunStatus:
    started = test_runner.start_run(payload.suite)
    if not started:
        raise HTTPException(status_code=409, detail="A test run is already in progress.")
    return TestRunStatus(**test_runner.get_status())


@router.get("/tests/status", response_model=TestRunStatus)
def test_status() -> TestRunStatus:
    return TestRunStatus(**test_runner.get_status())
