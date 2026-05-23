import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { TestRunStatus } from '../../api/types'

const POLL_INTERVAL_MS = 2000

function outcomeClass(outcome: string): string {
  if (outcome === 'passed') return 'outcome-passed'
  if (outcome === 'failed') return 'outcome-failed'
  return 'outcome-skipped'
}

export function TestRunner() {
  const [status, setStatus] = useState<TestRunStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const pollRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await api.admin.testStatus()
      setStatus(next)
      if (next.status !== 'running') {
        stopPolling()
      }
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch test status')
      stopPolling()
      return null
    }
  }, [stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    pollRef.current = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
  }, [refresh, stopPolling])

  useEffect(() => {
    void refresh().then((current) => {
      if (current?.status === 'running') {
        startPolling()
      }
    })
    return stopPolling
  }, [refresh, startPolling, stopPolling])

  async function runSuite(suite: 'backend' | 'frontend') {
    setError(null)
    setShowOutput(false)
    try {
      const started = await api.admin.runTests(suite)
      setStatus(started)
      startPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the test run')
    }
  }

  const running = status?.status === 'running'

  return (
    <div>
      <p className="muted">
        Run the automated test suites without leaving the browser. The backend suite is
        pytest; the frontend suite is Vitest.
      </p>
      <div className="player-controls">
        <button
          type="button"
          className="button-primary"
          disabled={running}
          onClick={() => void runSuite('backend')}
        >
          Run backend tests
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={running}
          onClick={() => void runSuite('frontend')}
        >
          Run frontend tests
        </button>
        {running && <span className="muted">Running {status?.suite} suite…</span>}
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {status && status.status === 'error' && (
        <div className="player-status failed">
          <strong>Test run failed to complete.</strong>
          <pre className="test-failure-message">{status.error}</pre>
        </div>
      )}

      {status && status.status === 'finished' && status.summary && (
        <div className="test-summary">
          {Object.entries(status.summary)
            .filter(([key]) => key !== 'total' && key !== 'collected')
            .map(([key, value]) => (
              <span key={key} className={outcomeClass(key)}>
                {value} {key}
              </span>
            ))}
          <span className="muted">
            {status.cases.length} tests · {status.suite} suite
          </span>
        </div>
      )}

      {status && status.cases.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Outcome</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {status.cases.map((testCase) => (
              <tr key={testCase.name}>
                <td>
                  {testCase.name}
                  {testCase.message && (
                    <pre className="test-failure-message">{testCase.message}</pre>
                  )}
                </td>
                <td className={outcomeClass(testCase.outcome)}>{testCase.outcome}</td>
                <td>
                  {testCase.duration_ms !== null && testCase.duration_ms !== undefined
                    ? `${testCase.duration_ms.toFixed(0)} ms`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {status?.raw_output && status.status !== 'running' && (
        <p>
          <button type="button" className="link-button" onClick={() => setShowOutput((v) => !v)}>
            {showOutput ? 'Hide' : 'Show'} raw output
          </button>
        </p>
      )}
      {showOutput && status?.raw_output && (
        <pre className="test-failure-message">{status.raw_output}</pre>
      )}
    </div>
  )
}
