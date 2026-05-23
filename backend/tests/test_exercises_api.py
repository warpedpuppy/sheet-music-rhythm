from tests.conftest import make_exercise


class TestListExercises:
    def test_requires_auth(self, client):
        assert client.get("/api/exercises").status_code == 401

    def test_lists_active_exercises_with_lock_flags(self, client, db, student_headers):
        make_exercise(db, title="Level 1", level=1)
        make_exercise(db, title="Level 2", level=2)
        make_exercise(db, title="Hidden", level=1, is_active=False)
        response = client.get("/api/exercises", headers=student_headers)
        assert response.status_code == 200
        body = response.json()
        assert [e["title"] for e in body] == ["Level 1", "Level 2"]
        assert body[0]["locked"] is False
        assert body[1]["locked"] is True

    def test_admin_sees_everything_unlocked(self, client, db, admin_headers):
        make_exercise(db, title="Level 5", level=5)
        response = client.get("/api/exercises", headers=admin_headers)
        assert response.json()[0]["locked"] is False


class TestGetExercise:
    def test_returns_pattern_and_tap_count(self, client, db, student_headers):
        exercise = make_exercise(
            db,
            events=[
                {"type": "note", "duration": "q"},
                {"type": "rest", "duration": "q"},
                {"type": "note", "duration": "q", "tieToNext": True},
                {"type": "note", "duration": "q"},
            ],
        )
        response = client.get(f"/api/exercises/{exercise.id}", headers=student_headers)
        assert response.status_code == 200
        body = response.json()
        assert len(body["pattern"]["events"]) == 4
        assert body["tap_count"] == 2

    def test_locked_exercise_is_forbidden(self, client, db, student_headers):
        exercise = make_exercise(db, level=5)
        response = client.get(f"/api/exercises/{exercise.id}", headers=student_headers)
        assert response.status_code == 403

    def test_missing_exercise_is_404(self, client, student_headers):
        assert client.get("/api/exercises/999", headers=student_headers).status_code == 404

    def test_inactive_exercise_is_404(self, client, db, student_headers):
        exercise = make_exercise(db, is_active=False)
        assert (
            client.get(f"/api/exercises/{exercise.id}", headers=student_headers).status_code
            == 404
        )
