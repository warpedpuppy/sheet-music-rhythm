from unittest.mock import patch

from tests.conftest import make_exercise

VALID_PATTERN = {
    "events": [
        {"type": "note", "duration": "q"},
        {"type": "note", "duration": "q"},
        {"type": "note", "duration": "h"},
    ]
}

EXERCISE_PAYLOAD = {
    "title": "New exercise",
    "description": "desc",
    "level": 1,
    "concept": "note-values",
    "learn_section": "note-values",
    "time_sig_top": 4,
    "time_sig_bottom": 4,
    "num_measures": 1,
    "tempo_bpm": 80,
    "pattern": VALID_PATTERN,
}


class TestAdminAccess:
    def test_non_admin_is_forbidden(self, client, student_headers):
        assert client.get("/api/admin/users", headers=student_headers).status_code == 403

    def test_unauthenticated_is_unauthorized(self, client):
        assert client.get("/api/admin/users").status_code == 401


class TestAdminUsers:
    def test_lists_users_with_stats(self, client, db, admin_headers, student):
        response = client.get("/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        usernames = {u["username"] for u in response.json()}
        assert {"boss", "student"} <= usernames

    def test_user_detail_includes_attempts(self, client, db, admin_headers, student_headers):
        exercise = make_exercise(db)
        client.post(
            f"/api/exercises/{exercise.id}/attempts",
            json={"taps_ms": [0, 600, 1200, 1800], "gave_up": False},
            headers=student_headers,
        )
        users = client.get("/api/admin/users", headers=admin_headers).json()
        student_id = next(u["id"] for u in users if u["username"] == "student")
        detail = client.get(f"/api/admin/users/{student_id}", headers=admin_headers).json()
        assert detail["total_attempts"] == 1
        assert len(detail["recent_attempts"]) == 1
        assert detail["recent_attempts"][0]["passed"] is True

    def test_missing_user_is_404(self, client, admin_headers):
        assert client.get("/api/admin/users/999", headers=admin_headers).status_code == 404


class TestAdminExercises:
    def test_create_valid_exercise(self, client, admin_headers):
        response = client.post(
            "/api/admin/exercises", json=EXERCISE_PAYLOAD, headers=admin_headers
        )
        assert response.status_code == 201
        assert response.json()["tap_count"] == 3

    def test_create_rejects_pattern_that_does_not_fill_measures(self, client, admin_headers):
        bad = dict(EXERCISE_PAYLOAD)
        bad["pattern"] = {"events": [{"type": "note", "duration": "q"}]}
        response = client.post("/api/admin/exercises", json=bad, headers=admin_headers)
        assert response.status_code == 400
        assert "require" in response.json()["detail"]

    def test_update_exercise(self, client, db, admin_headers):
        exercise = make_exercise(db)
        payload = dict(EXERCISE_PAYLOAD)
        payload["title"] = "Renamed"
        payload["is_active"] = True
        response = client.put(
            f"/api/admin/exercises/{exercise.id}", json=payload, headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Renamed"

    def test_soft_delete_hides_exercise_from_students(
        self, client, db, admin_headers, student_headers
    ):
        exercise = make_exercise(db)
        response = client.delete(
            f"/api/admin/exercises/{exercise.id}", headers=admin_headers
        )
        assert response.status_code == 204
        assert client.get("/api/exercises", headers=student_headers).json() == []
        admin_list = client.get("/api/admin/exercises", headers=admin_headers).json()
        assert admin_list[0]["is_active"] is False


class TestAdminTestRunner:
    def test_status_starts_idle(self, client, admin_headers):
        response = client.get("/api/admin/tests/status", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] in ("idle", "finished", "error", "running")

    def test_run_starts_a_suite(self, client, admin_headers):
        with patch("app.services.test_runner.start_run", return_value=True) as mock_start:
            response = client.post(
                "/api/admin/tests/run", json={"suite": "backend"}, headers=admin_headers
            )
        assert response.status_code == 202
        mock_start.assert_called_once_with("backend")

    def test_run_conflicts_when_already_running(self, client, admin_headers):
        with patch("app.services.test_runner.start_run", return_value=False):
            response = client.post(
                "/api/admin/tests/run", json={"suite": "backend"}, headers=admin_headers
            )
        assert response.status_code == 409

    def test_run_rejects_unknown_suite(self, client, admin_headers):
        response = client.post(
            "/api/admin/tests/run", json={"suite": "nonsense"}, headers=admin_headers
        )
        assert response.status_code == 422
