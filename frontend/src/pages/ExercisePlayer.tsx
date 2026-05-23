import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AttemptResult, Exercise, NextExercise, NoteStatus } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { RhythmStaff } from '../components/RhythmStaff'
import { AudioEngine, buildPlaybackTicks } from '../lib/audio'
import { expectedOnsets, onsetEventIndices, patternDurationMs } from '../lib/rhythm'
import { useTapCapture } from '../hooks/useTapCapture'

type Phase = 'loading' | 'idle' | 'recording' | 'submitting' | 'results' | 'playback'

export function ExercisePlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [playbackEventIndex, setPlaybackEventIndex] = useState<number | null>(null)
  const [next, setNext] = useState<NextExercise | null>(null)
  const [showPlayed, setShowPlayed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<AudioEngine | null>(null)
  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine()
    }
    return audioRef.current
  }

  const { taps, reset: resetTaps } = useTapCapture(phase === 'recording', startTime, () =>
    getAudio().clickNow(),
  )

  useEffect(() => {
    setPhase('loading')
    setExercise(null)
    setResult(null)
    setNext(null)
    setError(null)
    setShowPlayed(false)
    setPlaybackEventIndex(null)
    api
      .getExercise(Number(id))
      .then((data) => {
        setExercise(data)
        setPhase('idle')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercise'))
  }, [id])

  useEffect(() => {
    return () => {
      audioRef.current?.dispose()
      audioRef.current = null
    }
  }, [])

  const eventIndices = useMemo(
    () => (exercise ? onsetEventIndices(exercise.pattern) : []),
    [exercise],
  )
  const expectedCount = eventIndices.length

  const noteStatuses = useMemo(() => {
    if (!result || result.gave_up) return undefined
    const statuses: Record<number, NoteStatus> = {}
    result.results.forEach((noteResult) => {
      const eventIndex = eventIndices[noteResult.index]
      if (eventIndex !== undefined) {
        statuses[eventIndex] = noteResult.status
      }
    })
    return statuses
  }, [result, eventIndices])

  const submitAttempt = useCallback(
    async (tapsMs: number[], gaveUp: boolean) => {
      if (!exercise) return
      setPhase('submitting')
      try {
        const attempt = await api.submitAttempt(exercise.id, tapsMs, gaveUp)
        setResult(attempt)
        setShowPlayed(false)
        setPhase('results')
        void refreshUser()
        api.getNextExercise().then(setNext).catch(() => setNext(null))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit attempt')
        setPhase('idle')
      }
    },
    [exercise, refreshUser],
  )

  // The attempt is complete as soon as the user has tapped every note on the page.
  useEffect(() => {
    if (phase === 'recording' && expectedCount > 0 && taps.length >= expectedCount) {
      void submitAttempt(taps, false)
    }
  }, [phase, taps, expectedCount, submitAttempt])

  const handleStart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    getAudio() // create the AudioContext on a user gesture so the first tap can tick
    setResult(null)
    setNext(null)
    setShowPlayed(false)
    resetTaps()
    setStartTime(performance.now())
    setPhase('recording')
  }, [resetTaps])

  const playRhythm = useCallback(
    (recordGiveUp: boolean) => {
      if (!exercise) return
      getAudio().stop()
      setPhase('playback')

      const onsets = expectedOnsets(exercise.pattern, exercise.tempo_bpm)
      const total = patternDurationMs(exercise.pattern, exercise.tempo_bpm)
      const ticks = buildPlaybackTicks(onsets, total)

      getAudio().start(ticks, {
        onTick: (tick) => {
          if (tick.kind === 'note') {
            setPlaybackEventIndex(eventIndices[tick.index] ?? null)
          }
        },
        onDone: () => {
          setPlaybackEventIndex(null)
          if (recordGiveUp) {
            void submitAttempt(taps, true)
          } else {
            setPhase((current) => (current === 'playback' ? 'results' : current))
          }
        },
      })
    },
    [exercise, eventIndices, taps, submitAttempt],
  )

  const handleNext = useCallback(() => {
    if (!next || !next.exercise) {
      navigate('/dashboard')
      return
    }
    if (next.exercise.id === exercise?.id) {
      setResult(null)
      setPhase('idle')
      return
    }
    navigate(`/exercises/${next.exercise.id}`)
  }, [next, exercise, navigate])

  if (error) {
    return <div className="page-error">{error}</div>
  }
  if (!exercise || phase === 'loading') {
    return <div className="page-loading">Loading exercise…</div>
  }

  const accuracyPercent =
    result && result.accuracy != null ? Math.round(result.accuracy * 100) : null
  const madeAMistake = result != null && !result.gave_up && (result.accuracy ?? 0) < 1

  return (
    <div className="exercise-player">
      <div className="exercise-header">
        <div>
          <h1>{exercise.title}</h1>
          <p className="exercise-meta">
            Level {exercise.difficulty} · {exercise.time_signature} · {exercise.num_measures}{' '}
            measures · {expectedCount} notes
          </p>
        </div>
        {exercise.learn_section_slug && (
          <Link className="learn-link" to={`/learn#${exercise.learn_section_slug}`}>
            Read about {exercise.learn_section_slug.replace(/-/g, ' ')} →
          </Link>
        )}
      </div>

      <div className="staff-card card">
        <RhythmStaff
          pattern={exercise.pattern}
          timeSignature={exercise.time_signature}
          noteStatuses={phase === 'results' ? noteStatuses : undefined}
          playbackEventIndex={phase === 'playback' ? playbackEventIndex : null}
        />

        <div className="player-status" aria-live="polite">
          {phase === 'idle' && (
            <p>
              Press <strong>Start</strong>, then hit the <kbd>spacebar</kbd> in the rhythm of the
              notes shown. You set the speed — what matters is how the notes relate to each other.
              Each tap makes a tick, and the exercise ends after {expectedCount} taps.
            </p>
          )}
          {phase === 'recording' && (
            <p className="status-recording">
              <span className="recording-dot" /> Tap the spacebar in the rhythm shown —{' '}
              {taps.length} of {expectedCount} notes
            </p>
          )}
          {phase === 'submitting' && <p>Scoring your rhythm…</p>}
          {phase === 'playback' && (
            <p className="status-playback">Listen — the dot shows which note is sounding.</p>
          )}
          {phase === 'results' && result && (
            <div className={`result-summary ${result.passed ? 'passed' : 'failed'}`}>
              {result.gave_up ? (
                <p>
                  No problem — you heard the correct rhythm. Listen again or give it another try
                  when you&apos;re ready.
                </p>
              ) : (
                <>
                  <p className="result-headline">
                    {result.passed ? 'You got it!' : 'Not quite — keep practicing.'}{' '}
                    <strong>{accuracyPercent}%</strong> accuracy
                  </p>
                  <p className="result-detail">
                    {result.results.filter((r) => r.status === 'hit').length} on time ·{' '}
                    {result.results.filter((r) => r.status === 'early' || r.status === 'late').length}{' '}
                    early/late · {result.results.filter((r) => r.status === 'missed').length} missed
                    {result.detected_tempo_bpm != null &&
                      ` · you played at about ${result.detected_tempo_bpm} BPM`}
                  </p>
                </>
              )}
              {result.progression.leveled_up && (
                <p className="result-levelup">
                  Level {result.progression.unlocked_level} unlocked!
                </p>
              )}
              {result.progression.suggestion && (
                <p className="result-suggestion">{result.progression.suggestion}</p>
              )}
            </div>
          )}
        </div>

        <div className="player-controls">
          {(phase === 'idle' || phase === 'results') && (
            <button type="button" className="btn btn-primary btn-large" onClick={handleStart}>
              {phase === 'results' ? 'Try again' : 'Start'}
            </button>
          )}
          {(phase === 'idle' || phase === 'recording') && (
            <button type="button" className="btn btn-giveup" onClick={() => playRhythm(true)}>
              I give up — play it for me
            </button>
          )}
          {phase === 'results' && (
            <>
              <button type="button" className="btn" onClick={() => playRhythm(false)}>
                Hear the correct rhythm
              </button>
              {madeAMistake && result?.played_pattern && (
                <button type="button" className="btn" onClick={() => setShowPlayed((s) => !s)}>
                  {showPlayed ? 'Hide what you actually played' : 'Show what you actually played'}
                </button>
              )}
              {result?.passed && (
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Next exercise →
                </button>
              )}
              {result && !result.passed && next?.exercise && next.exercise.id !== exercise.id && (
                <button type="button" className="btn" onClick={handleNext}>
                  Try a suggested exercise →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {phase === 'results' && showPlayed && result?.played_pattern && (
        <div className="card played-rhythm">
          <h3>What you actually played</h3>
          <RhythmStaff
            pattern={result.played_pattern}
            timeSignature={exercise.time_signature}
            height={130}
          />
          <p className="muted">
            Your taps, written out as the closest note values
            {result.detected_tempo_bpm != null && ` at roughly ${result.detected_tempo_bpm} BPM`}.
            Compare it with the exercise above.
          </p>
        </div>
      )}

      <div className="exercise-tags">
        {exercise.concept_tags.map((tag) => (
          <span key={tag} className="tag">
            {tag.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
