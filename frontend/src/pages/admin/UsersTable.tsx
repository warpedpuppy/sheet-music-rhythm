import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { AdminUser, AdminUserDetail } from '../../api/types'

export function UsersTable() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.admin
      .listUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load users')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function showDetail(id: number) {
    try {
      setDetail(await api.admin.getUser(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    }
  }

  if (error) {
    return <p className="error-text">{error}</p>
  }
  if (!users) {
    return <p className="page-loading">Loading users…</p>
  }

  return (
    <div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Level</th>
            <th>Passed</th>
            <th>Attempts</th>
            <th>Joined</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.is_admin ? 'Admin' : 'Student'}</td>
              <td>{user.unlocked_level}</td>
              <td>{user.passed_exercises}</td>
              <td>{user.total_attempts}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <button type="button" className="link-button" onClick={() => void showDetail(user.id)}>
                  Progress
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail && (
        <div className="card admin-detail">
          <h2>{detail.username}</h2>
          <div className="admin-two-col">
            <div>
              <h3>Concepts</h3>
              {detail.concepts.length === 0 && <p className="muted">No attempts yet.</p>}
              <ul className="concept-list">
                {detail.concepts.map((concept) => (
                  <li
                    key={concept.concept}
                    className={`concept-pill${concept.mastered ? ' mastered' : ''}`}
                  >
                    {concept.concept.replace('-', ' ')}: {concept.passes}✓ / {concept.fails}✗
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Recent attempts</h3>
              {detail.recent_attempts.length === 0 && <p className="muted">No attempts yet.</p>}
              <table className="data-table">
                <tbody>
                  {detail.recent_attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.exercise_title}</td>
                      <td>{Math.round(attempt.accuracy * 100)}%</td>
                      <td className={attempt.passed ? 'outcome-passed' : 'outcome-failed'}>
                        {attempt.gave_up ? 'gave up' : attempt.passed ? 'passed' : 'failed'}
                      </td>
                      <td className="muted">
                        {attempt.mode === 'strict' ? 'strict' : 'free tempo'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
