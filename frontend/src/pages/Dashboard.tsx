import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { NextExercise, ProgressSummary } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function Dashboard() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [next, setNext] = useState<NextExercise | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getProgress(), api.getNextExercise()])
      .then(([progressData, nextData]) => {
        if (cancelled) return
        setProgress(progressData)
        setNext(nextData)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="error-text">{error}</p>
  }
  if (!progress || !next) {
    return <p className="page-loading">Loading your progress…</p>
  }

  return (
    <div>
      <h1>Welcome back, {user?.username}</h1>

      {progress.remediation_active && (
        <div className="remediation-banner">
          <strong>Practice mode.</strong> You hit a tricky exercise, so we're lining up
          similar <em>{progress.remediation_concept?.replace('-', ' ')}</em> rhythms until
          it clicks. Pass a couple and we'll send you back to the one that stumped you.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">
            {progress.unlocked_level} / {progress.max_level}
          </div>
          <div className="stat-label">Level unlocked</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {progress.total_passed_exercises} / {progress.total_exercises}
          </div>
          <div className="stat-label">Exercises passed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{progress.total_attempts}</div>
          <div className="stat-label">Total attempts</div>
        </div>
      </div>

      <div className="card">
        <h2>Up next</h2>
        <p>{next.message}</p>
        {next.exercise_id !== null ? (
          <Link to={`/exercises/${next.exercise_id}`} className="button-primary">
            Start “{next.title}” (level {next.level})
          </Link>
        ) : (
          <Link to="/exercises" className="button-secondary">
            Browse all exercises
          </Link>
        )}
      </div>

      {progress.concepts.length > 0 && (
        <>
          <h2>Concepts</h2>
          <ul className="concept-list">
            {progress.concepts.map((concept) => (
              <li
                key={concept.concept}
                className={`concept-pill${concept.mastered ? ' mastered' : ''}`}
                title={`${concept.passes} passed, ${concept.fails} failed`}
              >
                {concept.mastered ? '✓ ' : ''}
                {concept.concept.replace('-', ' ')}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
