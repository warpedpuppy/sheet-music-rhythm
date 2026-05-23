import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../../api/client'
import type { TestRunStatus } from '../../api/types'
import { TestRunner } from './TestRunner'

const IDLE: TestRunStatus = {
  suite: null,
  status: 'idle',
  started_at: null,
  finished_at: null,
  summary: null,
  cases: [],
  error: null,
  raw_output: null,
}

const FINISHED: TestRunStatus = {
  suite: 'backend',
  status: 'finished',
  started_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:00:30Z',
  summary: { passed: 2, failed: 1, total: 3 },
  cases: [
    { name: 'tests/test_a.py::test_one', outcome: 'passed', duration_ms: 12, message: null },
    { name: 'tests/test_a.py::test_two', outcome: 'passed', duration_ms: 8, message: null },
    {
      name: 'tests/test_b.py::test_three',
      outcome: 'failed',
      duration_ms: 20,
      message: 'AssertionError: expected 1 == 2',
    },
  ],
  error: null,
  raw_output: '3 tests ran',
}

describe('TestRunner', () => {
  it('starts a backend run and renders the per-test results when it finishes', async () => {
    vi.spyOn(api.admin, 'testStatus')
      .mockResolvedValueOnce(IDLE)
      .mockResolvedValue(FINISHED)
    const runSpy = vi
      .spyOn(api.admin, 'runTests')
      .mockResolvedValue({ ...IDLE, status: 'running', suite: 'backend' })

    render(<TestRunner />)
    await waitFor(() => expect(api.admin.testStatus).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: 'Run backend tests' }))
    expect(runSpy).toHaveBeenCalledWith('backend')

    expect(await screen.findByText('2 passed', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('1 failed')).toBeInTheDocument()
    expect(screen.getByText('tests/test_b.py::test_three')).toBeInTheDocument()
    expect(screen.getByText('AssertionError: expected 1 == 2')).toBeInTheDocument()
  })

  it('surfaces an error when the run cannot start', async () => {
    vi.spyOn(api.admin, 'testStatus').mockResolvedValue(IDLE)
    vi.spyOn(api.admin, 'runTests').mockRejectedValue(
      new Error('A test run is already in progress.'),
    )
    render(<TestRunner />)
    await userEvent.click(screen.getByRole('button', { name: 'Run frontend tests' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A test run is already in progress.',
    )
  })

  it('disables the run buttons while a suite is running', async () => {
    vi.spyOn(api.admin, 'testStatus').mockResolvedValue({
      ...IDLE,
      status: 'running',
      suite: 'backend',
    })
    render(<TestRunner />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run backend tests' })).toBeDisabled(),
    )
  })
})
