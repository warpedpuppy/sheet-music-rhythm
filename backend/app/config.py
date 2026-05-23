from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str = "dev-secret-key-change-me"
    database_url: str = "sqlite:///./app.db"
    admin_password: str = "admin123"
    access_token_expire_minutes: int = 60 * 24 * 7
    pass_threshold: float = 0.80
    hit_window_fraction: float = 0.10
    tolerance_fraction: float = 0.25
    tolerance_min_ms: float = 60.0
    extra_tap_penalty: float = 0.25
    consecutive_fails_for_remediation: int = 3
    remediation_passes_required: int = 2
    level_passes_to_unlock: int = 2

    model_config = {"env_file": ".env"}


VALID_LEARN_SLUGS = [
    "time-signatures",
    "note-values",
    "counting",
    "eighth-notes",
    "sixteenth-notes",
    "rests",
    "dotted-notes",
    "ties",
    "beams",
    "tempo",
    "syncopation",
    "simple-vs-compound",
]

settings = Settings()
