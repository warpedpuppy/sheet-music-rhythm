# Sheet Music Rhythm Trainer

A web app that teaches students to read rhythm in sheet music. Each exercise shows real notation
(rendered with VexFlow), plays a metronome count-in, and then listens to the student tapping the
**spacebar** in time with the printed rhythm. Taps are scored note-by-note, difficulty increases as
exercises are passed, and the trainer suggests similar/easier exercises when a student is stuck.
An "I give up" button ticks the correct rhythm out loud while a dot moves over each note as it
sounds. A comprehensive Learn section explains every rhythm concept with diagrams, and each
exercise links to the relevant section.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 + TypeScript + Vite, VexFlow (notation), Web Audio API (clicks), react-router |
| Backend  | FastAPI + SQLAlchemy 2 + Pydantic 2, JWT auth (bcrypt password hashing) |
| Database | SQLite (file `backend/app.db`); schema is Postgres-portable |
| Tests    | pytest (backend), Vitest + React Testing Library (frontend), runnable from the admin GUI |

## Requirements

- Python 3.11+ (3.12 recommended)
- Node.js **22.12+ or 24+** (Vite 8 requirement). On a machine using nvm with an older default,
  either `nvm install 22` / `nvm use 22`, or put a newer system Node first on your PATH before
  running the frontend or the backend dev server (the admin test runner shells out to `npx vitest`).

## Getting started

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# create the SQLite db, the admin + demo users, and ~20 seed exercises
python seed.py

# run the API on http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

Seeded accounts:

- `admin` / value of `ADMIN_PASSWORD` (defaults to `admin123` — change it via `backend/.env`)
- `demo` / `demo123`

Copy `backend/.env.example` to `backend/.env` to set `SECRET_KEY`, `ADMIN_PASSWORD`, or a different
`DATABASE_URL`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to http://localhost:8000)
```

Open http://localhost:5173, create an account (or log in as `demo`), and start tapping.

## How an exercise works

1. The rhythm is rendered on a percussion staff. A link below the title points to the Learn section
   that explains the concept being practiced.
2. Press **Start**: you hear a one-measure count-in, then quiet beat clicks while you tap the
   **spacebar** in time with the notation. Tap only where notes begin — never during rests or on
   tied notes.
3. Your taps are sent to the backend, which matches each tap to the expected note onsets within a
   tempo-scaled tolerance window. Each note is marked on time / early / late / missed (colored dots
   over the notation), and the attempt passes at 80% accuracy.
4. Passing exercises unlocks higher levels. Failing the same exercise three times starts a
   remediation detour: the trainer suggests similar exercises at the same or lower difficulty until
   you pass two of them, then steers you back.
5. **I give up** plays the correct rhythm as a ticking sound while a dot moves over each note as it
   sounds, then records the attempt (not as a pass).

## Admin

Log in as the admin user and open **Admin** in the navbar:

- **Users** — every account with unlocked level, passes, attempt counts, and per-user progress detail.
- **Exercises** — create, edit, or soft-delete exercises. The pattern editor accepts the JSON event
  format below and shows a live notation preview; the backend validates that the pattern exactly
  fills the declared measures.
- **Tests** — run the backend (pytest) or frontend (Vitest) suite from the browser and inspect
  per-test results, durations, and failure messages.

## Rhythm pattern format

Exercises store their rhythm as an ordered list of events:

```json
{
  "events": [
    { "type": "note", "duration": "q" },
    { "type": "rest", "duration": "8" },
    { "type": "note", "duration": "q", "dots": 1 },
    { "type": "note", "duration": "8", "tieToNext": true },
    { "type": "note", "duration": "q" }
  ]
}
```

- `duration`: `w`, `h`, `q`, `8`, `16` (whole → sixteenth)
- `dots: 1` extends the value by half
- `tieToNext: true` ties a note to the next one (the second note is held, not tapped)
- rests take time but must not be tapped
- the total must exactly fill `num_measures` of the exercise's time signature

## Running the tests from a terminal

```bash
# backend
cd backend && source .venv/bin/activate && pytest

# frontend
cd frontend && npm test          # vitest run
npm run build                    # type-check + production build
```

Both suites can also be triggered from the admin **Tests** tab.

## Project layout

```
backend/
  app/
    main.py            FastAPI app factory, CORS, routers
    models.py          SQLAlchemy models (users, exercises, attempts, progress, mastery, remediations)
    schemas.py         Pydantic request/response models
    auth.py            bcrypt + JWT, current-user / admin dependencies
    routers/           auth, exercises, attempts, progress, admin (incl. GUI test runner)
    services/
      rhythm.py        pattern validation + expected-onset math (pure)
      scoring.py       tap matching, per-note results, accuracy (pure)
      progression.py   level unlocks, concept mastery, remediation, next-exercise
      test_runner.py   subprocess pytest / vitest runner with lock + timeout
  seed.py              admin/demo users + 21 exercises across 7 levels
  tests/               pytest suite (62 tests)
frontend/
  src/
    api/               typed fetch client + API types
    auth/              AuthContext, route guards
    lib/               rhythm math, Web Audio engine, VexFlow pattern renderer
    hooks/             useTapCapture (spacebar capture)
    components/        RhythmStaff (notation + dot overlays), NotationExample, NavBar
    pages/             Home, Login, Register, Dashboard, ExerciseList, ExercisePlayer, Learn, Admin
    pages/admin/       UsersTable, ExerciseManager, TestRunner
```
