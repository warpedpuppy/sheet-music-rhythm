import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { AttemptResult, Exercise } from '../api/types'
import { tickEngine } from '../lib/audio'
import { ExercisePlayer } from './ExercisePlayer'

const EXERCISE: Exercise = {
  id: 1,
  title: 'Four steady quarters',
  description: 'Tap every beat.',
  level: 1,
  concept: 'note-values',
  learn_section: 'note-values',
  time_sig_top: 4,
  time_sig_bottom: 4,
  num_measures: 1,
  tempo_bpm: 80,
  pattern: {
    events: [
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
      { type: 'note', duration: 'q' },
    ],
  },
  is_active: true,
  tap_count: 4,
}

const PASSED_RESULT: AttemptResult = {
  attempt_id: 10,
  passed: true,
  gave_up: false,
  accuracy: 1,
  note_results: [0, 1, 2, 3].map((index) => ({
    index,
    expected_beat: index,
    actual_beat: index,
    deviation_beats: 0,
    verdict: 'on_time' as const,
  })),
  inferred_bpm: 100,
  unlocked_level: 1,
  newly_unlocked_level: null,
  remediation_started: false,
  remediation_active: false,
  message: 'Nice — you tapped that rhythm correctly!',
}

function renderPlayer() {
  return render(
    <MemoryRouter initialEntries={['/exercises/1']}>
      <Routes>
        <Route path="/exercises/:id" element={<ExercisePlayer />} />
        <Route path="/learn" element={<p>learn page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function tapSpace(times: number) {
  for (let i = 0; i < times; i++) {
    await userEvent.keyboard(' ')
  }
}

describe('ExercisePlayer', () => {
  it('loads the exercise and links to its Learn section', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(EXERCISE)
    renderPlayer()
    expect(await screen.findByText('Four steady quarters')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /learn about note values/i })
    expect(link).toHaveAttribute('href', '/learn#note-values')
  })

  it('captures the right number of taps and submits them', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(EXERCISE)
    const submitSpy = vi.spyOn(api, 'submitAttempt').mockResolvedValue(PASSED_RESULT)
    renderPlayer()
    await screen.findByText('Four steady quarters')

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText(/0 \/ 4 taps/)).toBeInTheDocument()

    await tapSpace(4)

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    const [exerciseId, taps, gaveUp] = submitSpy.mock.calls[0]
    expect(exerciseId).toBe(1)
    expect(taps).toHaveLength(4)
    expect(gaveUp).toBe(false)

    expect(await screen.findByText(/Passed!/)).toBeInTheDocument()
    expect(screen.getByText(/Accuracy: 100%/)).toBeInTheDocument()
  })

  it('runs the metronome at the exercise tempo while capturing and stops it after', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(EXERCISE)
    vi.spyOn(api, 'submitAttempt').mockResolvedValue(PASSED_RESULT)
    const startSpy = vi.spyOn(tickEngine, 'startMetronome')
    const stopSpy = vi.spyOn(tickEngine, 'stopMetronome')
    renderPlayer()
    await screen.findByText('Four steady quarters')

    expect(screen.queryByTestId('metronome')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(startSpy).toHaveBeenCalledWith(EXERCISE.tempo_bpm)
    expect(tickEngine.metronomeRunning).toBe(true)
    const metronome = screen.getByTestId('metronome')
    expect(metronome).toHaveAttribute('data-running', 'true')
    expect(metronome.querySelector('.metronome-pendulum.swinging')).not.toBeNull()

    await tapSpace(4)
    await screen.findByText(/Passed!/)
    expect(stopSpy).toHaveBeenCalled()
    expect(tickEngine.metronomeRunning).toBe(false)
    expect(screen.queryByTestId('metronome')).not.toBeInTheDocument()
  })

  it('submits a gave_up attempt after the give-up playback finishes', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(EXERCISE)
    const submitSpy = vi.spyOn(api, 'submitAttempt').mockResolvedValue({
      ...PASSED_RESULT,
      passed: false,
      gave_up: true,
      accuracy: 0,
      message: 'Attempt recorded.',
    })
    renderPlayer()
    await screen.findByText('Four steady quarters')

    await userEvent.click(screen.getByRole('button', { name: /I give up/ }))
    expect(screen.getByText(/Listen — this is the rhythm/)).toBeInTheDocument()

    await waitFor(() => expect(submitSpy).toHaveBeenCalledWith(1, [], true), {
      timeout: 5000,
    })
  })

  it('shows what the student actually played after a failed attempt', async () => {
    vi.spyOn(api, 'getExercise').mockResolvedValue(EXERCISE)
    vi.spyOn(api, 'submitAttempt').mockResolvedValue({
      ...PASSED_RESULT,
      passed: false,
      accuracy: 0.5,
      note_results: PASSED_RESULT.note_results.map((note, i) => ({
        ...note,
        verdict: i < 2 ? ('on_time' as const) : ('late' as const),
      })),
      message: 'Not quite.',
    })
    renderPlayer()
    await screen.findByText('Four steady quarters')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await tapSpace(4)

    const toggle = await screen.findByRole('button', { name: /Show what you actually played/ })
    await userEvent.click(toggle)
    expect(screen.getByText(/Your taps, written out as notation/)).toBeInTheDocument()
  })
})
