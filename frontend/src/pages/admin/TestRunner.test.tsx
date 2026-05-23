import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/client'
import type { TestRun } from '../../api/types'
import { TestRunner } from './TestRunner'

const runningRun: TestRun = {
  run_id: 'run-1',
  suite: 'backend',
  status: 'running',
  summary: null,
  tests: [],
  raw_output_tail: null,
}

const finishedRun: TestRun = {
  run_id: 'run-1',
  suite: 'backend',
  status: 'failed',
  summary: { total: 3, passed: 2, failed: 1, skipped: 0, duration_s: 4.2 },
  tests: [
    { nodeid: 'tests/test_scoring.py::test_perfect', outcome: 'passed', duration: 0.1, message: null },
    { nodeid: 'tests/test_scoring.py::test_missed', outcome: 'passed', duration: 0.2, message: null },
    {
      nodeid: 'tests/test_scoring.py::test_broken',
      outcome: 'failed',
      duration: 0.3,
      message: 'assert 1 == 2',
    },
  ],
  raw_output_tail: '1 failed, 2 passed',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TestRunner', () => {
  it('starts a backend run and shows the running state', async () => {
    const startSpy = vi.spyOn(api.admin, 'startTestRun').mockResolvedValue(runningRun)
    vi.spyOn(api.admin, 'getTestRun').mockResolvedValue(finishedRun)
    const user = userEvent.setup()
    render(<TestRunner />)

    const backendPanel = screen.getByText('Backend tests (pytest)').closest('.test-suite')!
    await user.click(screen.getAllByRole('button', { name: /run tests/i })[0])

    expect(startSpy).toHaveBeenCalledWith('backend')
    expect(await screen.findByText(/tests are running/i)).toBeInTheDocument()
    expect(backendPanel).toBeInTheDocument()
  })

  it('polls for results and renders the results table', async () => {
    vi.spyOn(api.admin, 'startTestRun').mockResolvedValue(runningRun)
    vi.spyOn(api.admin, 'getTestRun').mockResolvedValue(finishedRun)
    const user = userEvent.setup()
    render(<TestRunner />)

    await user.click(screen.getAllByRole('button', { name: /run tests/i })[0])

    expect(
      await screen.findByText(/some tests failed/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/2 passed · 1 failed/)).toBeInTheDocument()
    expect(screen.getByText('tests/test_scoring.py::test_broken')).toBeInTheDocument()
    expect(screen.getByText('assert 1 == 2')).toBeInTheDocument()
  }, 10000)

  it('shows an error when a run is already in progress', async () => {
    vi.spyOn(api.admin, 'startTestRun').mockRejectedValue(
      new Error('A test run is already in progress'),
    )
    const user = userEvent.setup()
    render(<TestRunner />)

    await user.click(screen.getAllByRole('button', { name: /run tests/i })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('already in progress')
  })
})
