from app.models import Attempt, Remediation
from app.services.progression import (
    CONSECUTIVE_FAILS_FOR_REMEDIATION,
    PASSES_TO_UNLOCK,
    REMEDIATION_PASSES_REQUIRED,
    active_remediation,
    consecutive_failures,
    get_or_create_progress,
    next_exercise,
    record_attempt_outcome,
    remediation_candidates,
)
from tests.conftest import make_exercise, make_user


def add_attempt(db, user, exercise, passed, gave_up=False):
    attempt = Attempt(
        user_id=user.id,
        exercise_id=exercise.id,
        accuracy=1.0 if passed else 0.0,
        passed=passed,
        gave_up=gave_up,
    )
    db.add(attempt)
    db.flush()
    return attempt


class TestLevelUnlock:
    def test_new_user_starts_at_level_one(self, db):
        user = make_user(db)
        assert get_or_create_progress(db, user).unlocked_level == 1

    def test_passing_enough_frontier_exercises_unlocks_next_level(self, db):
        user = make_user(db)
        level1 = [make_exercise(db, title=f"L1-{i}", level=1) for i in range(3)]
        make_exercise(db, title="L2-a", level=2)
        for i in range(PASSES_TO_UNLOCK):
            add_attempt(db, user, level1[i], passed=True)
            summary = record_attempt_outcome(db, user, level1[i], passed=True)
        assert summary.newly_unlocked_level == 2
        assert get_or_create_progress(db, user).unlocked_level == 2

    def test_one_pass_is_not_enough_to_unlock(self, db):
        user = make_user(db)
        exercise = make_exercise(db, title="L1-a", level=1)
        make_exercise(db, title="L1-b", level=1)
        make_exercise(db, title="L2-a", level=2)
        add_attempt(db, user, exercise, passed=True)
        summary = record_attempt_outcome(db, user, exercise, passed=True)
        assert summary.newly_unlocked_level is None

    def test_repassing_the_same_exercise_does_not_unlock(self, db):
        user = make_user(db)
        exercise = make_exercise(db, title="L1-a", level=1)
        make_exercise(db, title="L2-a", level=2)
        for _ in range(PASSES_TO_UNLOCK + 1):
            add_attempt(db, user, exercise, passed=True)
            summary = record_attempt_outcome(db, user, exercise, passed=True)
        assert summary.newly_unlocked_level is None

    def test_cannot_unlock_past_max_level(self, db):
        user = make_user(db)
        exercises = [make_exercise(db, title=f"L1-{i}", level=1) for i in range(2)]
        for exercise in exercises:
            add_attempt(db, user, exercise, passed=True)
            summary = record_attempt_outcome(db, user, exercise, passed=True)
        assert summary.newly_unlocked_level is None
        assert get_or_create_progress(db, user).unlocked_level == 1

    def test_passing_below_frontier_does_not_unlock(self, db):
        user = make_user(db)
        progress = get_or_create_progress(db, user)
        progress.unlocked_level = 2
        db.flush()
        level1 = [make_exercise(db, title=f"L1-{i}", level=1) for i in range(2)]
        make_exercise(db, title="L3-a", level=3)
        for exercise in level1:
            add_attempt(db, user, exercise, passed=True)
            summary = record_attempt_outcome(db, user, exercise, passed=True)
        assert summary.newly_unlocked_level is None


class TestRemediation:
    def make_stuck_user(self, db):
        user = make_user(db)
        source = make_exercise(db, title="Hard one", level=1, concept="rests")
        similar = [
            make_exercise(db, title=f"Similar {i}", level=1, concept="rests")
            for i in range(3)
        ]
        return user, source, similar

    def test_consecutive_failures_counts_until_a_pass(self, db):
        user = make_user(db)
        exercise = make_exercise(db)
        add_attempt(db, user, exercise, passed=False)
        add_attempt(db, user, exercise, passed=True)
        add_attempt(db, user, exercise, passed=False)
        add_attempt(db, user, exercise, passed=False)
        assert consecutive_failures(db, user.id, exercise.id) == 2

    def test_three_consecutive_fails_starts_remediation(self, db):
        user, source, _ = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            summary = record_attempt_outcome(db, user, source, passed=False)
        assert summary.remediation_started is True
        assert active_remediation(db, user.id) is not None

    def test_two_fails_do_not_start_remediation(self, db):
        user, source, _ = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION - 1):
            add_attempt(db, user, source, passed=False)
            summary = record_attempt_outcome(db, user, source, passed=False)
        assert summary.remediation_started is False
        assert active_remediation(db, user.id) is None

    def test_no_remediation_without_similar_exercises(self, db):
        user = make_user(db)
        source = make_exercise(db, title="Lonely", level=1, concept="unique-concept")
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            summary = record_attempt_outcome(db, user, source, passed=False)
        assert summary.remediation_started is False

    def test_next_exercise_suggests_similar_during_remediation(self, db):
        user, source, similar = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            record_attempt_outcome(db, user, source, passed=False)
        suggestion, reason, _ = next_exercise(db, user)
        assert reason == "remediation"
        assert suggestion.id in {e.id for e in similar}

    def test_passing_similar_exercises_completes_remediation(self, db):
        user, source, similar = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            record_attempt_outcome(db, user, source, passed=False)
        for i in range(REMEDIATION_PASSES_REQUIRED):
            add_attempt(db, user, similar[i], passed=True)
            summary = record_attempt_outcome(db, user, similar[i], passed=True)
        assert summary.remediation_completed is True
        assert active_remediation(db, user.id) is None

    def test_after_remediation_next_exercise_steers_back_to_source(self, db):
        user, source, similar = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            record_attempt_outcome(db, user, source, passed=False)
        for i in range(REMEDIATION_PASSES_REQUIRED):
            add_attempt(db, user, similar[i], passed=True)
            record_attempt_outcome(db, user, similar[i], passed=True)
        suggestion, reason, message = next_exercise(db, user)
        assert suggestion.id == source.id
        assert "retry" in message.lower() or "stuck" in message.lower()

    def test_passing_the_source_exercise_closes_remediation(self, db):
        user, source, _ = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False)
            record_attempt_outcome(db, user, source, passed=False)
        add_attempt(db, user, source, passed=True)
        summary = record_attempt_outcome(db, user, source, passed=True)
        assert summary.remediation_completed is True
        assert active_remediation(db, user.id) is None

    def test_remediation_candidates_exclude_passed_and_higher_levels(self, db):
        user = make_user(db)
        source = make_exercise(db, title="Source", level=2, concept="ties")
        same_level = make_exercise(db, title="Same level", level=2, concept="ties")
        lower = make_exercise(db, title="Lower", level=1, concept="ties")
        higher = make_exercise(db, title="Higher", level=3, concept="ties")
        other = make_exercise(db, title="Other concept", level=2, concept="rests")
        passed = make_exercise(db, title="Already passed", level=2, concept="ties")
        add_attempt(db, user, passed, passed=True)
        db.flush()
        candidates = remediation_candidates(db, user.id, source)
        ids = {c.id for c in candidates}
        assert ids == {same_level.id, lower.id}

    def test_gave_up_counts_as_failure_toward_remediation(self, db):
        user, source, _ = self.make_stuck_user(db)
        for _ in range(CONSECUTIVE_FAILS_FOR_REMEDIATION):
            add_attempt(db, user, source, passed=False, gave_up=True)
            summary = record_attempt_outcome(db, user, source, passed=False)
        assert summary.remediation_started is True


class TestNextExercise:
    def test_returns_lowest_unpassed_unlocked_exercise(self, db):
        user = make_user(db)
        first = make_exercise(db, title="A", level=1)
        second = make_exercise(db, title="B", level=1)
        make_exercise(db, title="C", level=2)
        add_attempt(db, user, first, passed=True)
        suggestion, reason, _ = next_exercise(db, user)
        assert reason == "progression"
        assert suggestion.id == second.id

    def test_locked_levels_are_not_suggested(self, db):
        user = make_user(db)
        only = make_exercise(db, title="A", level=1)
        make_exercise(db, title="B", level=2)
        add_attempt(db, user, only, passed=True)
        suggestion, reason, _ = next_exercise(db, user)
        assert reason == "complete"
        assert suggestion is None

    def test_complete_when_everything_passed(self, db):
        user = make_user(db)
        exercise = make_exercise(db, title="A", level=1)
        add_attempt(db, user, exercise, passed=True)
        suggestion, reason, _ = next_exercise(db, user)
        assert reason == "complete"
        assert suggestion is None
