import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { ExerciseListItem } from '../api/types'

const LEVEL_NAMES: Record<number, string> = {
  1: 'Quarter & half notes',
  2: 'Whole notes & time signatures',
  3: 'Rests',
  4: 'Eighth notes',
  5: 'Dotted notes',
  6: 'Ties',
  7: 'Sixteenths & syncopation',
}

export function ExerciseList() {
  const [exercises, setExercises] = useState<ExerciseListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listExercises()
      .then((data) => {
        if (!cancelled) setExercises(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byLevel = useMemo(() => {
    const groups = new Map<number, ExerciseListItem[]>()
    for (const exercise of exercises ?? []) {
      const group = groups.get(exercise.level) ?? []
      group.push(exercise)
      groups.set(exercise.level, group)
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  }, [exercises])

  if (error) {
    return <p className="error-text">{error}</p>
  }
  if (!exercises) {
    return <p className="page-loading">Loading exercises…</p>
  }

  return (
    <div>
      <h1>Exercises</h1>
      <p className="muted">
        Pass two exercises at your highest unlocked level to open the next one.
      </p>
      {byLevel.map(([level, items]) => {
        const locked = items.every((item) => item.locked)
        return (
          <section key={level} className="level-group">
            <h2>
              Level {level}: {LEVEL_NAMES[level] ?? items[0].concept.replace('-', ' ')}
              {locked && <span className="level-locked-tag">🔒 locked</span>}
            </h2>
            <div className="exercise-grid">
              {items.map((exercise) => (
                <Link
                  key={exercise.id}
                  to={`/exercises/${exercise.id}`}
                  className={`exercise-card${exercise.locked ? ' locked' : ''}`}
                  aria-disabled={exercise.locked}
                >
                  <span className="exercise-card-title">
                    {exercise.title}
                    {exercise.passed && <span className="passed-badge">✓ passed</span>}
                  </span>
                  <span className="exercise-card-meta">
                    {exercise.time_sig_top}/{exercise.time_sig_bottom} ·{' '}
                    {exercise.num_measures} measure{exercise.num_measures > 1 ? 's' : ''} ·{' '}
                    {exercise.attempt_count} attempt{exercise.attempt_count === 1 ? '' : 's'}
                  </span>
                  <span className="exercise-card-meta">{exercise.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
