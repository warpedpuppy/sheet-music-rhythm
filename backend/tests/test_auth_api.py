class TestRegister:
    def test_register_returns_token_and_user(self, client):
        response = client.post(
            "/api/auth/register", json={"username": "newkid", "password": "secret123"}
        )
        assert response.status_code == 201
        body = response.json()
        assert body["access_token"]
        assert body["user"]["username"] == "newkid"
        assert body["user"]["is_admin"] is False

    def test_register_duplicate_username_conflicts(self, client):
        payload = {"username": "newkid", "password": "secret123"}
        assert client.post("/api/auth/register", json=payload).status_code == 201
        assert client.post("/api/auth/register", json=payload).status_code == 409

    def test_register_rejects_short_password(self, client):
        response = client.post(
            "/api/auth/register", json={"username": "newkid", "password": "abc"}
        )
        assert response.status_code == 422

    def test_register_rejects_invalid_username_characters(self, client):
        response = client.post(
            "/api/auth/register", json={"username": "bad name!", "password": "secret123"}
        )
        assert response.status_code == 422


class TestLogin:
    def test_login_with_correct_credentials(self, client, student):
        response = client.post(
            "/api/auth/login", json={"username": "student", "password": "password1"}
        )
        assert response.status_code == 200
        assert response.json()["user"]["username"] == "student"

    def test_login_with_wrong_password_fails(self, client, student):
        response = client.post(
            "/api/auth/login", json={"username": "student", "password": "wrong"}
        )
        assert response.status_code == 401

    def test_login_with_unknown_user_fails(self, client):
        response = client.post(
            "/api/auth/login", json={"username": "ghost", "password": "whatever"}
        )
        assert response.status_code == 401


class TestMe:
    def test_me_returns_current_user(self, client, student_headers):
        response = client.get("/api/auth/me", headers=student_headers)
        assert response.status_code == 200
        assert response.json()["username"] == "student"

    def test_me_without_token_is_unauthorized(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_me_with_garbage_token_is_unauthorized(self, client):
        response = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer not.a.token"}
        )
        assert response.status_code == 401
