import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { TestRun } from '../../api/types'

const POLL_INTERVAL_MS = 2000

interface SuiteState {
  run: TestRun | null
  starting: boolean
  error: string | null
}

const INITIAL: SuiteState = { run: null, starting: false, error: null }

export function TestRunner() {
  const [backend, setBackend] = useState<SuiteState>(INITIAL)
  const [frontend, setFrontend] = useState<SuiteState>(INITIAL)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const setterFor = (suite: 'backend' | 'frontend') =>
    suite === 'backend' ? setBackend : setFrontend

  const startRun = async (suite: 'backend' | 'frontend') => {
    const setState = setterFor(suite)
    setState({ run: null, starting: true, error: null })
    try {
      const run = await api.admin.startTestRun(suite)
      setState({ run, starting: false, error: null })
      poll(suite, run.run_id)
    } catch (err) {
      setState({
        run: null,
        starting: false,
        error: err instanceof Error ? err.message : 'Failed to start test run',
      })
    }
  }

  const poll = (suite: 'backend' | 'frontend', runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    const setState = setterFor(suite)
    pollRef.current = setInterval(async () => {
      try {
        const run = await api.admin.getTestRun(runId)
        setState({ run, starting: false, error: null })
        if (run.status !== 'running' && pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch (err) {
        setState({
          run: null,
          starting: false,
          error: err instanceof Error ? err.message : 'Failed to poll test run',
        })
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    }, POLL_INTERVAL_MS)
  }

  return (
    <div className="test-runner">
      <p className="muted">
        Run the automated test suites directly from the browser. Backend tests run with pytest;
        frontend tests run with Vitest. Only one run can be active at a time.
      </p>
      <div className="test-suites">
        <SuitePanel
          title="Backend tests (pytest)"
          state={backend}
          onRun={() => startRun('backend')}
        />
        <SuitePanel
          title="Frontend tests (Vitest)"
          state={frontend}
          onRun={() => startRun('frontend')}
        />
      </div>
    </div>
  )
}

function SuitePanel({
  title,
  state,
  onRun,
}: {
  title: string
  state: SuiteState
  onRun: () => void
}) {
  const { run, starting, error } = state
  const running = starting || run?.status === 'running'

  return (
    <div className="card test-suite">
      <div className="test-suite-header">
        <h3>{title}</h3>
        <button type="button" className="btn btn-primary" onClick={onRun} disabled={running}>
          {running ? 'Running…' : 'Run tests'}
        </button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {running && (
        <p className="test-running">
          <span className="spinner" /> Tests are running — results will appear here.
        </p>
      )}

      {run && run.status !== 'running' && (
        <div className="test-results">
          <div className={`test-status test-status-${run.status}`}>
            {run.status === 'passed' && 'All tests passed'}
            {run.status === 'failed' && 'Some tests failed'}
            {run.status === 'error' && 'The test run could not complete'}
            {run.status === 'timeout' && 'The test run timed out'}
          </div>
          {run.summary && (
            <p className="test-summary">
              {run.summary.passed} passed · {run.summary.failed} failed · {run.summary.skipped}{' '}
              skipped · {run.summary.total} total · {run.summary.duration_s}s
            </p>
          )}
          {run.tests.length > 0 && (
            <table className="admin-table test-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {run.tests.map((test) => (
                  <tr key={test.nodeid} className={test.outcome === 'passed' ? '' : 'test-row-failed'}>
                    <td>
                      {test.nodeid}
                      {test.message && (
                        <details>
                          <summary>Failure details</summary>
                          <pre className="test-failure">{test.message}</pre>
                        </details>
                      )}
                    </td>
                    <td>{test.outcome}</td>
                    <td>{test.duration}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {run.status === 'error' && run.raw_output_tail && (
            <pre className="test-failure">{run.raw_output_tail}</pre>
          )}
        </div>
      )}
    </div>
  )
}
