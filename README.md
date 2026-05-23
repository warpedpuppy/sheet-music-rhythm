# Sheet Music Rhythm Trainer

A web app that teaches students to read rhythm in sheet music. Each exercise shows real
notation (rendered with VexFlow) and the student taps the printed rhythm on the
**spacebar** at their own speed — every tap ticks back, and the attempt ends once they
have tapped every note on the page. Taps are scored note-by-note against the notated
rhythm (the app infers the student's tempo from their taps), difficulty increases as
exercises are passed, and the trainer suggests similar exercises when a student is
stuck. An **"I give up"** button ticks the correct rhythm out loud while a dot moves
over each note as it sounds. A comprehensive **Learn** section explains every rhythm
concept with notation diagrams, and each exercise links to the relevant section.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 + TypeScript + Vite, VexFlow (notation), Web Audio API (clicks), react-router |
| Backend  | FastAPI + SQLAlchemy 2 + Pydantic 2, JWT auth (bcrypt password hashing) |
| Database | SQLite (file `backend/app.db`); the schema is plain SQLAlchemy and is Postgres-portable |
| Tests    | pytest (backend, 97 tests) and Vitest + React Testing Library (frontend, 36 tests), both runnable from the admin GUI |

## Requirements

- Python 3.11+ (3.12 recommended)
- Node.js **22.12+** (Vite 8 requirement). If your default `node` is older, put a newer
  one first on your PATH before running the frontend *and* before starting the backend
  (the admin test runner shells out to `npx vitest`).

## Getting started

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# create the SQLite db, the admin + demo users, and 22 seed exercises
python seed.py

# run the API on http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

Seeded accounts:

- `admin` / value of `ADMIN_PASSWORD` (defaults to `admin123` — change it in `backend/.env`)
- `demo` / `demo123`

Copy `backend/.env.example` to `backend/.env` to set `SECRET_KEY`, `ADMIN_PASSWORD`, or a
different `DATABASE_URL`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to http://localhost:8000)
```

Open http://localhost:5173, create an account (or log in as `demo`), and start tapping.

## How an exercise works

1. The rhythm is rendered on a percussion staff. A link under the title points to the
   Learn section that explains the concept being practiced.
2. Press **Start**, then tap the **spacebar** in the rhythm of the notes shown. A
   metronome starts ticking at the exercise's written tempo — a softer, lower "tock" at
   half the volume of the spacebar tick, with a pendulum swinging on screen — as a
   pacing guide only: scoring is still free-tempo, so you set the speed and the attempt
   ends as soon as you have tapped as many notes as are on the page. Tap only where
   notes begin — never during rests or on the second note of a tie.
3. Your taps are sent to the backend, which anchors your first tap to the first note,
   infers your tempo from the span of your taps, and checks whether each note landed
   where the notation says it should. Each note is marked on time / early / late /
   wrong / missed (colored dots over the notation) and the attempt passes at **80%
   on-time notes**.
4. If you made a mistake, **Show what you actually played** writes your taps out as
   notation below the exercise so you can compare it with what was printed.
5. Passing **two** exercises at your highest unlocked level unlocks the next level.
   Failing (or giving up on) the same exercise **three** times in a row starts a
   remediation detour: the trainer suggests similar exercises at the same or lower
   difficulty until you pass two of them, then steers you back to the one that stumped
   you.
6. **I give up** plays the correct rhythm as a ticking sound (at the exercise's written
   tempo) while a dot moves over each note as it sounds, then records the attempt (not
   as a pass).

## Admin

Log in as the admin user and open **Admin** in the navbar:

- **Users** — every account with its unlocked level, attempt counts, per-concept
  progress, and recent attempts.
- **Exercises** — create, edit, or deactivate exercises. The pattern editor accepts the
  JSON event format below, shows a live notation preview, and the backend rejects any
  pattern that does not exactly fill the declared measures.
- **Tests** — run the backend (pytest) or frontend (Vitest) suite from the browser and
  inspect per-test outcomes, durations, and failure messages.

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
      scoring.py       free-tempo tap matching, per-note verdicts, accuracy (pure)
      progression.py   level unlocks, concept mastery, remediation, next-exercise
      test_runner.py   subprocess pytest / vitest runner with lock + timeout
  seed.py              admin/demo users + 22 exercises across 7 levels
  tests/               pytest suite
frontend/
  src/
    api/               typed fetch client + API types
    auth/              AuthContext, route guards
    lib/               rhythm math, Web Audio tick engine, VexFlow pattern renderer
    hooks/             useTapCapture (spacebar capture)
    components/        RhythmStaff (notation + dot overlays), NotationExample, NavBar
    pages/             Home, Login, Register, Dashboard, ExerciseList, ExercisePlayer, Learn
    pages/admin/       Admin tabs: UsersTable, ExerciseManager, TestRunner
```
