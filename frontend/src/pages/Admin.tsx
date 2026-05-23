import { useState } from 'react'
import { UsersTable } from './admin/UsersTable'
import { ExerciseManager } from './admin/ExerciseManager'
import { TestRunner } from './admin/TestRunner'

type Tab = 'users' | 'exercises' | 'tests'

export function Admin() {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="admin-page">
      <h1>Admin</h1>
      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'exercises'}
          className={`tab ${tab === 'exercises' ? 'active' : ''}`}
          onClick={() => setTab('exercises')}
        >
          Exercises
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tests'}
          className={`tab ${tab === 'tests' ? 'active' : ''}`}
          onClick={() => setTab('tests')}
        >
          Tests
        </button>
      </div>

      {tab === 'users' && <UsersTable />}
      {tab === 'exercises' && <ExerciseManager />}
      {tab === 'tests' && <TestRunner />}
    </div>
  )
}
