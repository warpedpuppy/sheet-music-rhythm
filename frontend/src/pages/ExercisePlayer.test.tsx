import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { AttemptResult, Exercise } from '../api/types'
import { AuthProvider } from '../auth/AuthContext'
import { ExercisePlayer } from './ExercisePlayer'

// The audio engine is replaced with a stub: taps "tick" silently and the
// give-up playback finishes immediately, so tests drive the flow synchronously.
vi.mock('../lib/audio', () => {
  class FakeAudioEngine {
    clickNow() {}
    start(_ticks: unknown, handlers: { onDone?: () => void } = {}) {
      handlers.onDone?.()
      return 0
    }
    stop() {}
    dispose() {}
  }
  return {
    AudioEngine: FakeAudioEngine,
    buildPlaybackTicks: () => [],
  }
})

const exercise: Exercise = {
  id: 1,
  title: 'Steady Quarters',
  difficulty: 1,
  time_signature: '4/4',
  tempo_bpm: 60,
  num_measures: 1,
  pattern: {
    events: [
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
    ],
  },
  concept_tags: ['quarter-notes'],
  learn_section_slug: 'note-values',
  user_status: null,
}

const imperfectPass: AttemptResult = {
  attempt_id: 10,
  gave_up: false,
  results: [
    { index: 0, expected_ms: 0, status: 'hit', tap_ms: 0, delta_ms: 0 },
    { index: 1, expected_ms: 700, status: 'hit', tap_ms: 710, delta_ms: 10 },
    { index: 2, expected_ms: 1400, status: 'late', tap_ms: 1550, delta_ms: 150 },
    { index: 3, expected_ms: 2100, status: 'missed', tap_ms: null, delta_ms: null },
  ],
  accuracy: 0.875,
  passed: true,
  detected_tempo_bpm: 86,
  played_pattern: {
    events: [
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q', dots: 1 },
      { type: 'note', duration: '8' },
      { type: 'note', duration: 'q' },
    ],
  },
  progression: {
    unlocked_level: 1,
    leveled_up: false,
    remediation_started: false,
    remediation_resolved: false,
    suggestion: null,
  },
}

const gaveUpResult: AttemptResult = {
  ...imperfectPass,
  gave_up: true,
  results: [],
  accuracy: null,
  passed: false,
  detected_tempo_bpm: null,
  played_pattern: null,
}

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={['/exercises/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/exercises/:id" element={<ExercisePlayer />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('ExercisePlayer', () => {
  it('shows the exercise, instructions, give-up button, and learn link', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(exercise)
    renderPlayer()

    expect(await screen.findByRole('heading', { name: 'Steady Quarters' })).toBeInTheDocument()
    expect(screen.getByText(/in the rhythm of the notes shown/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i give up/i })).toBeInTheDocument()
    const learnLink = screen.getByRole('link', { name: /read about note values/i })
    expect(learnLink).toHaveAttribute('href', '/learn#note-values')
  })

  it('finishes after one tap per note, shows the score, and can reveal what was played', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(exercise)
    const submitSpy = vi.spyOn(api, 'submitAttempt').mockResolvedValue(imperfectPass)
    vi.spyOn(api, 'getNextExercise').mockResolvedValue({
      exercise: { ...exercise, id: 2, title: 'Next One' },
      reason: 'progression',
      source_exercise_id: null,
      source_exercise_title: null,
    })
    const user = userEvent.setup()
    renderPlayer()

    await screen.findByRole('heading', { name: 'Steady Quarters' })
    await user.click(screen.getByRole('button', { name: /^start$/i }))

    expect(await screen.findByText(/0 of 4 notes/i)).toBeInTheDocument()
    await user.keyboard('[Space]')
    await user.keyboard('[Space]')
    await user.keyboard('[Space]')
    await user.keyboard('[Space]')

    await waitFor(() => expect(submitSpy).toHaveBeenCalled())
    const [exerciseId, taps, gaveUp] = submitSpy.mock.calls[0]
    expect(exerciseId).toBe(1)
    expect(taps).toHaveLength(4)
    expect(gaveUp).toBe(false)

    expect(await screen.findByText(/you got it!/i)).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText(/about 86 BPM/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next exercise/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show what you actually played/i }))
    expect(screen.getByRole('heading', { name: /what you actually played/i })).toBeInTheDocument()
  })

  it('records a gave-up attempt without any taps required', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(exercise)
    const submitSpy = vi.spyOn(api, 'submitAttempt').mockResolvedValue(gaveUpResult)
    vi.spyOn(api, 'getNextExercise').mockResolvedValue({
      exercise: null,
      reason: 'completed',
      source_exercise_id: null,
      source_exercise_title: null,
    })
    const user = userEvent.setup()
    renderPlayer()

    await screen.findByRole('heading', { name: 'Steady Quarters' })
    await user.click(screen.getByRole('button', { name: /i give up/i }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(1, [], true))
    expect(await screen.findByText(/you heard the correct rhythm/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show what you actually played/i })).not.toBeInTheDocument()
  })
})
