import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { NextExercise, Progress } from '../api/types'
import { useAuth } from '../auth/AuthContext'

const REASON_LABELS: Record<string, string> = {
  progression: 'Next up in your level',
  remediation: 'Suggested practice before retrying a tricky exercise',
  'retry-original': 'Ready to retry the exercise you were stuck on',
  practice: 'Everything passed — polish your weakest exercise',
  completed: 'You have completed every exercise!',
}

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [next, setNext] = useState<NextExercise | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getProgress(), api.getNextExercise()])
      .then(([progressData, nextData]) => {
        setProgress(progressData)
        setNext(nextData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load progress'))
  }, [])

  if (error) {
    return <div className="page-error">{error}</div>
  }
  if (!progress || !next) {
    return <div className="page-loading">Loading your progress…</div>
  }

  return (
    <div className="dashboard">
      <h1>Welcome back, {user?.username}</h1>

      <section className="dashboard-next card">
        <h2>Continue practicing</h2>
        <p className="next-reason">{REASON_LABELS[next.reason]}</p>
        {next.reason === 'remediation' && next.source_exercise_title && (
          <p className="next-context">
            We noticed “{next.source_exercise_title}” has been tough — let&apos;s build up to it.
          </p>
        )}
        {next.exercise ? (
          <div className="next-exercise-row">
            <div>
              <strong>{next.exercise.title}</strong>
              <span className="exercise-meta">
                {' '}
                · Level {next.exercise.difficulty} · {next.exercise.time_signature} ·{' '}
                {next.exercise.tempo_bpm} BPM
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/exercises/${next.exercise!.id}`)}
            >
              Start
            </button>
          </div>
        ) : (
          <p>
            You have mastered the whole library. Browse the <Link to="/exercises">exercise list</Link>{' '}
            to keep your skills sharp.
          </p>
        )}
      </section>

      {progress.active_remediation && (
        <section className="card remediation-banner">
          <h3>Working through a tricky spot</h3>
          <p>
            Practice progress toward retrying “{progress.active_remediation.source_exercise_title}”:{' '}
            {progress.active_remediation.passes_done} / {progress.active_remediation.passes_required}{' '}
            similar exercises passed.
          </p>
        </section>
      )}

      <section className="dashboard-grid">
        <div className="card">
          <h2>Levels</h2>
          <p className="muted">Unlocked level: {progress.unlocked_level}</p>
          <ul className="level-list">
            {progress.per_level.map((level) => (
              <li key={level.difficulty} className="level-row">
                <span className={level.difficulty <= progress.unlocked_level ? '' : 'muted'}>
                  Level {level.difficulty}
                  {level.difficulty > progress.unlocked_level && ' (locked)'}
                </span>
                <div className="level-bar">
                  <div
                    className="level-bar-fill"
                    style={{ width: `${level.total ? (level.passed_count / level.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="level-count">
                  {level.passed_count}/{level.total}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Concept mastery</h2>
          {progress.concepts.length === 0 ? (
            <p className="muted">Complete your first exercise to start tracking concepts.</p>
          ) : (
            <ul className="concept-list">
              {progress.concepts.map((concept) => (
                <li key={concept.concept} className="concept-row">
                  <span className="concept-name">{concept.concept.replace(/-/g, ' ')}</span>
                  <div className="level-bar">
                    <div className="level-bar-fill" style={{ width: `${concept.mastery * 100}%` }} />
                  </div>
                  <span className="level-count">{Math.round(concept.mastery * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
