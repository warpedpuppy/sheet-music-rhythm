from tests.conftest import make_exercise

QUARTERS = [
    {"type": "note", "duration": "q"},
    {"type": "note", "duration": "q"},
    {"type": "note", "duration": "q"},
    {"type": "note", "duration": "q"},
]


def submit(client, headers, exercise_id, taps_ms, gave_up=False):
    return client.post(
        f"/api/exercises/{exercise_id}/attempts",
        json={"taps_ms": taps_ms, "gave_up": gave_up},
        headers=headers,
    )


class TestSubmitAttempt:
    def test_perfect_attempt_passes(self, client, db, student_headers):
        exercise = make_exercise(db, events=QUARTERS)
        response = submit(client, student_headers, exercise.id, [0, 600, 1200, 1800])
        assert response.status_code == 201
        body = response.json()
        assert body["passed"] is True
        assert body["accuracy"] == 1.0
        assert [n["verdict"] for n in body["note_results"]] == ["on_time"] * 4
        assert body["inferred_bpm"] == 100.0

    def test_bad_attempt_fails_with_feedback(self, client, db, student_headers):
        exercise = make_exercise(db, events=QUARTERS)
        response = submit(client, student_headers, exercise.id, [0, 200, 1700, 1800])
        body = response.json()
        assert body["passed"] is False
        assert body["accuracy"] < 0.8

    def test_give_up_records_a_failed_attempt(self, client, db, student_headers):
        exercise = make_exercise(db, events=QUARTERS)
        response = submit(client, student_headers, exercise.id, [], gave_up=True)
        body = response.json()
        assert body["passed"] is False
        assert body["gave_up"] is True
        assert all(n["verdict"] == "missed" for n in body["note_results"])

    def test_locked_exercise_rejects_attempts(self, client, db, student_headers):
        exercise = make_exercise(db, level=5, events=QUARTERS)
        response = submit(client, student_headers, exercise.id, [0, 600, 1200, 1800])
        assert response.status_code == 403

    def test_unknown_exercise_is_404(self, client, student_headers):
        assert submit(client, student_headers, 999, [0, 600]).status_code == 404

    def test_passing_two_frontier_exercises_unlocks_next_level(
        self, client, db, student_headers
    ):
        first = make_exercise(db, title="A", level=1, events=QUARTERS)
        second = make_exercise(db, title="B", level=1, events=QUARTERS)
        make_exercise(db, title="C", level=2, events=QUARTERS)
        submit(client, student_headers, first.id, [0, 600, 1200, 1800])
        response = submit(client, student_headers, second.id, [0, 600, 1200, 1800])
        body = response.json()
        assert body["newly_unlocked_level"] == 2
        assert body["unlocked_level"] == 2

    def test_three_failures_start_remediation(self, client, db, student_headers):
        source = make_exercise(db, title="Hard", level=1, concept="rests", events=QUARTERS)
        make_exercise(db, title="Easier", level=1, concept="rests", events=QUARTERS)
        for _ in range(3):
            response = submit(client, student_headers, source.id, [], gave_up=True)
        body = response.json()
        assert body["remediation_started"] is True
        assert body["remediation_active"] is True

    def test_attempt_history_is_persisted(self, client, db, student_headers):
        exercise = make_exercise(db, events=QUARTERS)
        submit(client, student_headers, exercise.id, [0, 600, 1200, 1800])
        listing = client.get("/api/exercises", headers=student_headers).json()
        assert listing[0]["attempt_count"] == 1
        assert listing[0]["passed"] is True


class TestProgressEndpoints:
    def test_progress_summary(self, client, db, student_headers):
        exercise = make_exercise(db, events=QUARTERS, concept="note-values")
        make_exercise(db, title="Other", level=2, events=QUARTERS)
        submit(client, student_headers, exercise.id, [0, 600, 1200, 1800])
        response = client.get("/api/progress", headers=student_headers)
        body = response.json()
        assert body["unlocked_level"] == 1
        assert body["max_level"] == 2
        assert body["total_attempts"] == 1
        assert body["total_passed_exercises"] == 1
        assert body["concepts"][0]["concept"] == "note-values"
        assert body["concepts"][0]["passes"] == 1

    def test_next_exercise_endpoint(self, client, db, student_headers):
        first = make_exercise(db, title="A", level=1, events=QUARTERS)
        make_exercise(db, title="B", level=1, events=QUARTERS)
        submit(client, student_headers, first.id, [0, 600, 1200, 1800])
        response = client.get("/api/progress/next", headers=student_headers)
        body = response.json()
        assert body["reason"] == "progression"
        assert body["title"] == "B"

    def test_next_exercise_when_complete(self, client, db, student_headers):
        first = make_exercise(db, title="A", level=1, events=QUARTERS)
        submit(client, student_headers, first.id, [0, 600, 1200, 1800])
        response = client.get("/api/progress/next", headers=student_headers)
        assert response.json()["reason"] == "complete"
