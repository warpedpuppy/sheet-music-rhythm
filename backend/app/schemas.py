from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Duration = Literal["w", "h", "q", "8", "16"]
Verdict = Literal["on_time", "early", "late", "wrong", "missed"]


# ---------------------------------------------------------------------------
# Rhythm pattern
# ---------------------------------------------------------------------------


class PatternEvent(BaseModel):
    type: Literal["note", "rest"]
    duration: Duration
    dots: int = Field(default=0, ge=0, le=1)
    tieToNext: bool = False


class Pattern(BaseModel):
    events: list[PatternEvent] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Auth / users
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------


class ExerciseBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    level: int = Field(ge=1, le=20)
    concept: str = Field(min_length=1, max_length=64)
    learn_section: str = Field(min_length=1, max_length=64)
    time_sig_top: int = Field(default=4, ge=1, le=12)
    time_sig_bottom: Literal[2, 4, 8] = 4
    num_measures: int = Field(default=1, ge=1, le=8)
    tempo_bpm: int = Field(default=80, ge=30, le=240)
    pattern: Pattern


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(ExerciseBase):
    is_active: bool = True


class ExerciseOut(ExerciseBase):
    id: int
    is_active: bool
    tap_count: int


class ExerciseListItem(BaseModel):
    id: int
    title: str
    description: str
    level: int
    concept: str
    learn_section: str
    time_sig_top: int
    time_sig_bottom: int
    num_measures: int
    locked: bool
    passed: bool
    attempt_count: int


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------


class AttemptCreate(BaseModel):
    taps_ms: list[float] = Field(default_factory=list)
    gave_up: bool = False


class NoteResult(BaseModel):
    index: int
    expected_beat: float
    actual_beat: float | None
    deviation_beats: float | None
    verdict: Verdict


class AttemptResult(BaseModel):
    attempt_id: int
    passed: bool
    gave_up: bool
    accuracy: float
    note_results: list[NoteResult]
    inferred_bpm: float | None
    unlocked_level: int
    newly_unlocked_level: int | None
    remediation_started: bool
    remediation_active: bool
    message: str


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------


class ConceptMasteryOut(BaseModel):
    concept: str
    passes: int
    fails: int
    mastered: bool


class ProgressSummary(BaseModel):
    unlocked_level: int
    max_level: int
    total_attempts: int
    total_passed_exercises: int
    total_exercises: int
    concepts: list[ConceptMasteryOut]
    remediation_active: bool
    remediation_concept: str | None


class NextExerciseOut(BaseModel):
    exercise_id: int | None
    title: str | None
    level: int | None
    reason: Literal["progression", "remediation", "complete"]
    message: str


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


class AdminUserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime
    unlocked_level: int
    total_attempts: int
    passed_exercises: int


class AdminUserDetail(AdminUserOut):
    concepts: list[ConceptMasteryOut]
    recent_attempts: list["AdminAttemptOut"]


class AdminAttemptOut(BaseModel):
    id: int
    exercise_id: int
    exercise_title: str
    accuracy: float
    passed: bool
    gave_up: bool
    created_at: datetime


class TestRunRequest(BaseModel):
    suite: Literal["backend", "frontend"]


class TestCaseResult(BaseModel):
    name: str
    outcome: str
    duration_ms: float | None = None
    message: str | None = None


class TestRunStatus(BaseModel):
    suite: str | None
    status: Literal["idle", "running", "finished", "error"]
    started_at: datetime | None
    finished_at: datetime | None
    summary: dict[str, int] | None
    cases: list[TestCaseResult]
    error: str | None
    raw_output: str | None
