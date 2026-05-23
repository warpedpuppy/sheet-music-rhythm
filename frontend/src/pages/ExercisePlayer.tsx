import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { AttemptResult, Exercise, NextExercise, NoteStatus } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { RhythmStaff } from '../components/RhythmStaff'
import { AudioEngine, buildExerciseTicks, buildPlaybackTicks } from '../lib/audio'
import { beatMs, expectedOnsets, onsetEventIndices, totalDurationMs } from '../lib/rhythm'
import { useTapCapture } from '../hooks/useTapCapture'

type Phase = 'loading' | 'idle' | 'counting' | 'recording' | 'submitting' | 'results' | 'playback'

export function ExercisePlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [countBeat, setCountBeat] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [playbackEventIndex, setPlaybackEventIndex] = useState<number | null>(null)
  const [next, setNext] = useState<NextExercise | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<AudioEngine | null>(null)
  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine()
    }
    return audioRef.current
  }

  const capturing = phase === 'counting' || phase === 'recording'
  const { taps, reset: resetTaps } = useTapCapture(capturing, startTime)
  const tapsRef = useRef<number[]>([])
  useEffect(() => {
    tapsRef.current = taps
  }, [taps])

  useEffect(() => {
    setPhase('loading')
    setExercise(null)
    setResult(null)
    setNext(null)
    setError(null)
    setCountBeat(null)
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

  const handleStart = useCallback(() => {
    if (!exercise) return
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setResult(null)
    setNext(null)
    resetTaps()
    setPhase('counting')

    const bms = beatMs(exercise.tempo_bpm)
    const total = totalDurationMs(exercise.pattern, exercise.time_signature, exercise.tempo_bpm)
    const ticks = buildExerciseTicks(exercise.count_in_beats, bms, total)
    const start = getAudio().start(ticks, {
      onTick: (tick) => {
        if (tick.kind === 'count') {
          setCountBeat(tick.index)
        } else if (tick.kind === 'beat') {
          setCountBeat(null)
          setPhase((current) => (current === 'counting' ? 'recording' : current))
        }
      },
      onDone: () => {
        setCountBeat(null)
        void submitAttempt(tapsRef.current, false)
      },
    })
    setStartTime(start)
  }, [exercise, resetTaps, submitAttempt])

  const playRhythm = useCallback(
    (recordGiveUp: boolean) => {
      if (!exercise) return
      getAudio().stop()
      setCountBeat(null)
      setPhase('playback')

      const bms = beatMs(exercise.tempo_bpm)
      const total = totalDurationMs(exercise.pattern, exercise.time_signature, exercise.tempo_bpm)
      const onsets = expectedOnsets(exercise.pattern, exercise.time_signature, exercise.tempo_bpm)
      const ticks = buildPlaybackTicks(exercise.count_in_beats, bms, onsets, total)

      getAudio().start(ticks, {
        onTick: (tick) => {
          if (tick.kind === 'count') {
            setCountBeat(tick.index)
            setPlaybackEventIndex(null)
          } else if (tick.kind === 'note') {
            setCountBeat(null)
            setPlaybackEventIndex(eventIndices[tick.index] ?? null)
          }
        },
        onDone: () => {
          setPlaybackEventIndex(null)
          setCountBeat(null)
          if (recordGiveUp) {
            void submitAttempt(tapsRef.current, true)
          } else {
            setPhase((current) => (current === 'playback' ? 'results' : current))
          }
        },
      })
    },
    [exercise, eventIndices, submitAttempt],
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

  return (
    <div className="exercise-player">
      <div className="exercise-header">
        <div>
          <h1>{exercise.title}</h1>
          <p className="exercise-meta">
            Level {exercise.difficulty} · {exercise.time_signature} · {exercise.tempo_bpm} BPM ·{' '}
            {exercise.num_measures} measures
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
              Press <strong>Start</strong>, listen to the {exercise.count_in_beats}-beat count-in,
              then tap the <kbd>spacebar</kbd> in time with the rhythm.
            </p>
          )}
          {phase === 'counting' && (
            <p className="status-counting">
              Count-in:{' '}
              <span className="count-beats">
                {Array.from({ length: exercise.count_in_beats }, (_, i) => (
                  <span key={i} className={`count-beat ${countBeat === i ? 'active' : ''}`}>
                    {i + 1}
                  </span>
                ))}
              </span>
            </p>
          )}
          {phase === 'recording' && (
            <p className="status-recording">
              <span className="recording-dot" /> Tap the rhythm now — {taps.length} taps
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
                    {result.passed ? 'Passed!' : 'Not quite — keep practicing.'}{' '}
                    <strong>{accuracyPercent}%</strong> accuracy
                  </p>
                  <p className="result-detail">
                    {result.results.filter((r) => r.status === 'hit').length} on time ·{' '}
                    {result.results.filter((r) => r.status === 'early' || r.status === 'late').length}{' '}
                    early/late · {result.results.filter((r) => r.status === 'missed').length} missed
                    {result.extra_taps.length > 0 && ` · ${result.extra_taps.length} extra taps`}
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
          {(phase === 'idle' || phase === 'counting' || phase === 'recording') && (
            <button type="button" className="btn btn-giveup" onClick={() => playRhythm(true)}>
              I give up — play it for me
            </button>
          )}
          {phase === 'results' && (
            <>
              <button type="button" className="btn" onClick={() => playRhythm(false)}>
                Hear the correct rhythm
              </button>
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
