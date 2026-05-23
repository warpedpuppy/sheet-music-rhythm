import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AttemptResult, Exercise } from '../api/types'
import { Metronome } from '../components/Metronome'
import { RhythmStaff } from '../components/RhythmStaff'
import type { DotMarker } from '../components/RhythmStaff'
import { useTapCapture } from '../hooks/useTapCapture'
import { tickEngine } from '../lib/audio'
import { expectedOnsets, onsetTimesMs, tapsToPattern } from '../lib/rhythm'

type Phase = 'idle' | 'capturing' | 'submitting' | 'playback' | 'result'

export function ExercisePlayer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [lastTaps, setLastTaps] = useState<number[]>([])
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const [showPlayed, setShowPlayed] = useState(false)

  const onsets = useMemo(() => (exercise ? expectedOnsets(exercise.pattern) : []), [exercise])

  const submitAttempt = useCallback(
    async (tapsMs: number[], gaveUp: boolean) => {
      if (!exercise) return
      setPhase('submitting')
      try {
        const attempt = await api.submitAttempt(exercise.id, tapsMs, gaveUp)
        setResult(attempt)
        setPhase('result')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not submit your attempt')
        setPhase('idle')
      }
    },
    [exercise],
  )

  const tapCapture = useTapCapture({
    expectedTaps: exercise?.tap_count ?? Infinity,
    onTap: () => tickEngine.tick('tap'),
    onComplete: (tapsMs) => {
      tickEngine.stopMetronome()
      setLastTaps(tapsMs)
      void submitAttempt(tapsMs, false)
    },
  })
  const { reset: resetCapture } = tapCapture

  useEffect(() => {
    let cancelled = false
    setExercise(null)
    setResult(null)
    setError(null)
    setPhase('idle')
    setShowPlayed(false)
    setPlayingIndex(null)
    resetCapture()
    api
      .getExercise(Number(id))
      .then((data) => {
        if (!cancelled) setExercise(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
      tickEngine.cancelAll()
    }
  }, [id, resetCapture])

  function handleStart() {
    if (!exercise) return
    setResult(null)
    setShowPlayed(false)
    setPlayingIndex(null)
    tickEngine.startMetronome(exercise.tempo_bpm)
    setPhase('capturing')
    tapCapture.start()
  }

  function handleGiveUp() {
    if (!exercise) return
    tickEngine.stopMetronome()
    tapCapture.reset()
    setResult(null)
    setShowPlayed(false)
    setPhase('playback')
    const offsets = onsetTimesMs(exercise.pattern, exercise.tempo_bpm)
    tickEngine.playSchedule(
      offsets,
      (index) => setPlayingIndex(index),
      () => {
        setPlayingIndex(null)
        void submitAttempt([], true)
      },
    )
  }

  function handleTryAgain() {
    tickEngine.cancelAll()
    setResult(null)
    setShowPlayed(false)
    setPlayingIndex(null)
    tapCapture.reset()
    setPhase('idle')
  }

  async function handleNext() {
    try {
      const next = await api.getNextExercise()
      if (next.exercise_id !== null && next.exercise_id !== exercise?.id) {
        navigate(`/exercises/${next.exercise_id}`)
      } else if (next.exercise_id !== null) {
        handleTryAgain()
      } else {
        navigate('/exercises')
      }
    } catch {
      navigate('/exercises')
    }
  }

  if (error && !exercise) {
    return (
      <div>
        <p className="error-text">{error}</p>
        <Link to="/exercises" className="button-secondary">
          Back to exercises
        </Link>
      </div>
    )
  }
  if (!exercise) {
    return <p className="page-loading">Loading exercise…</p>
  }

  const dots: DotMarker[] = []
  if (phase === 'playback' && playingIndex !== null && onsets[playingIndex]) {
    dots.push({ eventIndex: onsets[playingIndex].eventIndex, kind: 'playing' })
  }
  if (phase === 'result' && result && !result.gave_up) {
    for (const note of result.note_results) {
      const onset = onsets[note.index]
      if (onset) {
        dots.push({
          eventIndex: onset.eventIndex,
          kind: note.verdict,
          label: note.verdict.replace('_', ' '),
        })
      }
    }
  }

  const inferredMsPerBeat = result?.inferred_bpm ? 60000 / result.inferred_bpm : 600

  return (
    <div>
      <div className="player-header">
        <div>
          <h1>{exercise.title}</h1>
          <p className="muted">
            Level {exercise.level} · {exercise.time_sig_top}/{exercise.time_sig_bottom} ·{' '}
            {exercise.tap_count} taps ·{' '}
            <Link to={`/learn#${exercise.learn_section}`}>
              Learn about {exercise.concept.replace('-', ' ')} →
            </Link>
          </p>
        </div>
      </div>

      {exercise.description && <p>{exercise.description}</p>}

      <RhythmStaff
        pattern={exercise.pattern}
        timeSigTop={exercise.time_sig_top}
        timeSigBottom={exercise.time_sig_bottom}
        dots={dots}
      />

      {phase === 'capturing' && (
        <div className="capturing-hint" role="status">
          <Metronome bpm={exercise.tempo_bpm} running />
          <div>
            Tap the <strong>spacebar</strong> in the rhythm shown above. The metronome is
            ticking at the written tempo as a guide, but you set the speed.{' '}
            <span className="tap-progress">
              {tapCapture.taps.length} / {exercise.tap_count} taps
            </span>
          </div>
        </div>
      )}

      {phase === 'playback' && (
        <div className="player-status" role="status">
          Listen — this is the rhythm the notation is asking for.
        </div>
      )}

      {phase === 'result' && result && (
        <div
          className={`player-status ${result.passed ? 'passed' : 'failed'}`}
          role="status"
        >
          <strong>{result.passed ? 'Passed!' : result.gave_up ? 'No worries.' : 'Not quite.'}</strong>{' '}
          {result.message}
          {!result.gave_up && (
            <>
              {' '}
              Accuracy: {Math.round(result.accuracy * 100)}%
              {result.inferred_bpm ? ` at ≈${Math.round(result.inferred_bpm)} BPM.` : '.'}
            </>
          )}
          {!result.gave_up && (
            <div className="result-legend">
              <span>
                <span className="legend-swatch" style={{ background: '#2e9e5b' }} /> on time
              </span>
              <span>
                <span className="legend-swatch" style={{ background: '#e0a73c' }} /> early / late
              </span>
              <span>
                <span className="legend-swatch" style={{ background: '#d9534f' }} /> wrong
              </span>
              <span>
                <span className="legend-swatch" style={{ background: '#9aa0a6' }} /> missed
              </span>
            </div>
          )}
        </div>
      )}

      <div className="player-controls">
        {(phase === 'idle' || phase === 'result') && (
          <button type="button" className="button-primary" onClick={handleStart}>
            {phase === 'result' ? 'Try again' : 'Start'}
          </button>
        )}
        {phase === 'capturing' && (
          <button type="button" className="button-secondary" onClick={handleTryAgain}>
            Cancel
          </button>
        )}
        {phase === 'result' && (
          <button type="button" className="button-secondary" onClick={() => void handleNext()}>
            Next exercise →
          </button>
        )}
        {(phase === 'idle' || phase === 'capturing' || phase === 'result') && (
          <button type="button" className="button-danger" onClick={handleGiveUp}>
            I give up — play it for me
          </button>
        )}
        {phase === 'submitting' && <span className="muted">Checking your rhythm…</span>}
      </div>

      {phase === 'result' && result && !result.gave_up && !result.passed && lastTaps.length > 1 && (
        <div className="played-back">
          <button
            type="button"
            className="link-button"
            onClick={() => setShowPlayed((value) => !value)}
          >
            {showPlayed ? 'Hide' : 'Show'} what you actually played
          </button>
          {showPlayed && (
            <RhythmStaff
              pattern={tapsToPattern(lastTaps, inferredMsPerBeat)}
              timeSigTop={exercise.time_sig_top}
              timeSigBottom={exercise.time_sig_bottom}
              caption="Your taps, written out as notation (approximate)."
            />
          )}
        </div>
      )}
    </div>
  )
}
