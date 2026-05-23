"""Runs the backend (pytest) or frontend (vitest) test suite in a subprocess.

Results are kept in memory; only one run may be active at a time.
"""

import json
import subprocess
import sys
import tempfile
import threading
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
TIMEOUT_S = 300

_lock = threading.Lock()
_runs: dict[str, dict] = {}


def get_run(run_id: str) -> dict | None:
    return _runs.get(run_id)


def start_run(suite: str) -> dict | None:
    """Start a test run in a background thread. Returns None if a run is already active."""
    if not _lock.acquire(blocking=False):
        return None
    run_id = uuid.uuid4().hex[:12]
    state = {
        "run_id": run_id,
        "suite": suite,
        "status": "running",
        "summary": None,
        "tests": [],
        "raw_output_tail": None,
    }
    _runs[run_id] = state
    thread = threading.Thread(target=_execute, args=(state, suite), daemon=True)
    thread.start()
    return state


def _execute(state: dict, suite: str) -> None:
    try:
        if suite == "backend":
            _run_pytest(state)
        else:
            _run_vitest(state)
    except subprocess.TimeoutExpired:
        state["status"] = "timeout"
    except Exception as exc:  # pragma: no cover - defensive
        state["status"] = "error"
        state["raw_output_tail"] = str(exc)
    finally:
        _lock.release()


def _tail(text: str, lines: int = 50) -> str:
    return "\n".join(text.splitlines()[-lines:])


def _run_pytest(state: dict) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        report_file = Path(tmpdir) / "report.json"
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                "tests",
                "-q",
                "--json-report",
                f"--json-report-file={report_file}",
            ],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
        if not report_file.exists():
            state["status"] = "error"
            state["raw_output_tail"] = _tail(proc.stdout + "\n" + proc.stderr)
            return
        report = json.loads(report_file.read_text())

    tests = []
    for test in report.get("tests", []):
        message = None
        call = test.get("call") or {}
        if test.get("outcome") == "failed":
            message = call.get("longrepr") or test.get("longrepr")
        tests.append(
            {
                "nodeid": test.get("nodeid", ""),
                "outcome": test.get("outcome", "unknown"),
                "duration": round(call.get("duration", 0.0), 3),
                "message": message,
            }
        )
    summary = report.get("summary", {})
    state["tests"] = tests
    state["summary"] = {
        "total": summary.get("total", len(tests)),
        "passed": summary.get("passed", 0),
        "failed": summary.get("failed", 0) + summary.get("error", 0),
        "skipped": summary.get("skipped", 0),
        "duration_s": round(report.get("duration", 0.0), 2),
    }
    state["raw_output_tail"] = _tail(proc.stdout)
    state["status"] = "passed" if proc.returncode == 0 else "failed"


def _run_vitest(state: dict) -> None:
    if not FRONTEND_DIR.exists():
        state["status"] = "error"
        state["raw_output_tail"] = f"Frontend directory not found at {FRONTEND_DIR}"
        return
    with tempfile.TemporaryDirectory() as tmpdir:
        report_file = Path(tmpdir) / "vitest.json"
        proc = subprocess.run(
            [
                "npx",
                "vitest",
                "run",
                "--reporter=json",
                f"--outputFile={report_file}",
            ],
            cwd=FRONTEND_DIR,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
        if not report_file.exists():
            state["status"] = "error"
            state["raw_output_tail"] = _tail(proc.stdout + "\n" + proc.stderr)
            return
        report = json.loads(report_file.read_text())

    tests = []
    for file_result in report.get("testResults", []):
        file_name = Path(file_result.get("name", "")).name
        for assertion in file_result.get("assertionResults", []):
            failure = assertion.get("failureMessages") or []
            tests.append(
                {
                    "nodeid": f"{file_name} > {assertion.get('fullName') or assertion.get('title', '')}",
                    "outcome": assertion.get("status", "unknown"),
                    "duration": round((assertion.get("duration") or 0) / 1000.0, 3),
                    "message": "\n".join(failure) if failure else None,
                }
            )
    duration_s = 0.0
    if report.get("startTime"):
        end_times = [r.get("endTime", 0) for r in report.get("testResults", [])]
        if end_times:
            duration_s = round((max(end_times) - report["startTime"]) / 1000.0, 2)
    state["tests"] = tests
    state["summary"] = {
        "total": report.get("numTotalTests", len(tests)),
        "passed": report.get("numPassedTests", 0),
        "failed": report.get("numFailedTests", 0),
        "skipped": report.get("numPendingTests", 0),
        "duration_s": duration_s,
    }
    state["raw_output_tail"] = _tail(proc.stdout + "\n" + proc.stderr)
    state["status"] = "passed" if report.get("success") else "failed"
