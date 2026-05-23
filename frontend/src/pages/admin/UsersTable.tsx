import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { AdminUser, AdminUserProgress } from '../../api/types'

export function UsersTable() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [selected, setSelected] = useState<AdminUserProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.admin
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'))
  }, [])

  const showDetail = (userId: number) => {
    setSelected(null)
    api.admin
      .getUserProgress(userId)
      .then(setSelected)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user progress'))
  }

  if (error) return <div className="page-error">{error}</div>
  if (!users) return <div className="page-loading">Loading users…</div>

  return (
    <div className="admin-users">
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Unlocked level</th>
            <th>Exercises passed</th>
            <th>Total attempts</th>
            <th>Last active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.is_admin ? 'Admin' : 'Student'}</td>
              <td>{user.unlocked_level}</td>
              <td>{user.exercises_passed}</td>
              <td>{user.total_attempts}</td>
              <td>{user.last_active ? new Date(user.last_active).toLocaleString() : '—'}</td>
              <td>
                <button type="button" className="btn btn-small" onClick={() => showDetail(user.id)}>
                  Progress
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="card user-detail">
          <h3>{selected.user.username} — progress</h3>
          <p className="muted">Unlocked level: {selected.progress.unlocked_level}</p>
          <div className="user-detail-grid">
            <div>
              <h4>Levels</h4>
              <ul>
                {selected.progress.per_level.map((level) => (
                  <li key={level.difficulty}>
                    Level {level.difficulty}: {level.passed_count}/{level.total} passed
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Concepts</h4>
              {selected.progress.concepts.length === 0 ? (
                <p className="muted">No attempts yet.</p>
              ) : (
                <ul>
                  {selected.progress.concepts.map((concept) => (
                    <li key={concept.concept}>
                      {concept.concept.replace(/-/g, ' ')}: {Math.round(concept.mastery * 100)}%
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4>Recent attempts</h4>
              {selected.recent_attempts.length === 0 ? (
                <p className="muted">No attempts yet.</p>
              ) : (
                <ul>
                  {selected.recent_attempts.map((attempt) => (
                    <li key={attempt.id}>
                      Exercise #{attempt.exercise_id} —{' '}
                      {attempt.gave_up
                        ? 'gave up'
                        : `${attempt.accuracy != null ? Math.round(attempt.accuracy * 100) : 0}% ${
                            attempt.passed ? '(passed)' : '(failed)'
                          }`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {selected.progress.active_remediation && (
            <p className="muted">
              Currently remediating “{selected.progress.active_remediation.source_exercise_title}” (
              {selected.progress.active_remediation.passes_done}/
              {selected.progress.active_remediation.passes_required} similar passes).
            </p>
          )}
        </div>
      )}
    </div>
  )
}
