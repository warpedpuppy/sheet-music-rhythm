import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Exercise } from '../api/types'

export function ExerciseList() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listExercises()
      .then(setExercises)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercises'))
  }, [])

  if (error) {
    return <div className="page-error">{error}</div>
  }
  if (!exercises) {
    return <div className="page-loading">Loading exercises…</div>
  }

  const byLevel = new Map<number, Exercise[]>()
  exercises.forEach((exercise) => {
    const list = byLevel.get(exercise.difficulty) ?? []
    list.push(exercise)
    byLevel.set(exercise.difficulty, list)
  })
  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b)

  return (
    <div className="exercise-list-page">
      <h1>Exercises</h1>
      {levels.map((level) => (
        <section key={level} className="level-section">
          <h2>Level {level}</h2>
          <div className="exercise-grid">
            {(byLevel.get(level) ?? []).map((exercise) => {
              const status = exercise.user_status
              const locked = status?.locked ?? false
              return (
                <div key={exercise.id} className={`exercise-card ${locked ? 'locked' : ''}`}>
                  <div className="exercise-card-header">
                    <h3>{exercise.title}</h3>
                    {status?.passed && <span className="badge badge-pass">Passed</span>}
                    {locked && <span className="badge badge-locked">Locked</span>}
                  </div>
                  <p className="exercise-meta">
                    {exercise.time_signature} · {exercise.tempo_bpm} BPM · {exercise.num_measures}{' '}
                    measures
                  </p>
                  <p className="exercise-tags">
                    {exercise.concept_tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag.replace(/-/g, ' ')}
                      </span>
                    ))}
                  </p>
                  {status && status.attempts_count > 0 && (
                    <p className="muted">
                      Best accuracy:{' '}
                      {status.best_accuracy != null ? `${Math.round(status.best_accuracy * 100)}%` : '—'}{' '}
                      ({status.attempts_count} attempts)
                    </p>
                  )}
                  {locked ? (
                    <span className="muted">Pass earlier levels to unlock</span>
                  ) : (
                    <Link to={`/exercises/${exercise.id}`} className="btn btn-small btn-primary">
                      {status?.passed ? 'Practice again' : 'Start'}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
