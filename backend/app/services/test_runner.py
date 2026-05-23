"""Run the backend (pytest) or frontend (Vitest) suite from the admin GUI.

A single background thread runs the suite as a subprocess; a lock rejects concurrent
runs. Results are parsed into per-test cases that the admin UI renders as a table.
"""

import json
import os
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import BACKEND_DIR

FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
TIMEOUT_SECONDS = 300

_lock = threading.Lock()
_state: dict[str, Any] = {
    "suite": None,
    "status": "idle",
    "started_at": None,
    "finished_at": None,
    "summary": None,
    "cases": [],
    "error": None,
    "raw_output": None,
}


def get_status() -> dict[str, Any]:
    with _lock:
        return dict(_state)


def start_run(suite: str) -> bool:
    """Start a suite in a background thread. Returns False if a run is in progress."""
    with _lock:
        if _state["status"] == "running":
            return False
        _state.update(
            suite=suite,
            status="running",
            started_at=datetime.now(timezone.utc),
            finished_at=None,
            summary=None,
            cases=[],
            error=None,
            raw_output=None,
        )
    thread = threading.Thread(target=_run, args=(suite,), daemon=True)
    thread.start()
    return True


def _finish(**updates: Any) -> None:
    with _lock:
        _state.update(finished_at=datetime.now(timezone.utc), **updates)


def _run(suite: str) -> None:
    try:
        if suite == "backend":
            cases, summary, raw = _run_pytest()
        else:
            cases, summary, raw = _run_vitest()
        _finish(status="finished", cases=cases, summary=summary, raw_output=raw)
    except subprocess.TimeoutExpired:
        _finish(status="error", error=f"Test run timed out after {TIMEOUT_SECONDS}s.")
    except Exception as exc:  # surface anything to the admin UI rather than crashing
        _finish(status="error", error=f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# pytest
# ---------------------------------------------------------------------------


def _run_pytest() -> tuple[list[dict], dict, str]:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        report_path = Path(tmp.name)
    try:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                "-q",
                "--json-report",
                f"--json-report-file={report_path}",
            ],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        raw = (proc.stdout or "") + (proc.stderr or "")
        if not report_path.exists() or report_path.stat().st_size == 0:
            raise RuntimeError(f"pytest produced no report (exit {proc.returncode}). Output:\n{raw}")
        report = json.loads(report_path.read_text())
    finally:
        report_path.unlink(missing_ok=True)

    cases = []
    for test in report.get("tests", []):
        message = None
        for stage in ("setup", "call", "teardown"):
            info = test.get(stage) or {}
            if info.get("outcome") == "failed":
                message = info.get("longrepr") or (info.get("crash") or {}).get("message")
                break
        duration = sum((test.get(s) or {}).get("duration", 0) for s in ("setup", "call", "teardown"))
        cases.append(
            {
                "name": test.get("nodeid", "?"),
                "outcome": test.get("outcome", "unknown"),
                "duration_ms": round(duration * 1000, 1),
                "message": message,
            }
        )
    summary = {k: v for k, v in (report.get("summary") or {}).items() if isinstance(v, int)}
    return cases, summary, raw


# ---------------------------------------------------------------------------
# Vitest
# ---------------------------------------------------------------------------


def _run_vitest() -> tuple[list[dict], dict, str]:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        report_path = Path(tmp.name)
    try:
        proc = subprocess.run(
            ["npx", "vitest", "run", "--reporter=json", f"--outputFile={report_path}"],
            cwd=FRONTEND_DIR,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            env=os.environ.copy(),
        )
        raw = (proc.stdout or "") + (proc.stderr or "")
        if not report_path.exists() or report_path.stat().st_size == 0:
            raise RuntimeError(f"Vitest produced no report (exit {proc.returncode}). Output:\n{raw}")
        report = json.loads(report_path.read_text())
    finally:
        report_path.unlink(missing_ok=True)

    cases = []
    for file_result in report.get("testResults", []):
        file_name = Path(file_result.get("name", "?")).name
        for assertion in file_result.get("assertionResults", []):
            failure = assertion.get("failureMessages") or []
            cases.append(
                {
                    "name": f"{file_name} › {assertion.get('fullName') or assertion.get('title', '?')}",
                    "outcome": assertion.get("status", "unknown"),
                    "duration_ms": assertion.get("duration"),
                    "message": "\n".join(failure) if failure else None,
                }
            )
    summary = {
        "passed": report.get("numPassedTests", 0),
        "failed": report.get("numFailedTests", 0),
        "pending": report.get("numPendingTests", 0),
        "total": report.get("numTotalTests", 0),
    }
    return cases, summary, raw
