import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Exercise, ExercisePayload, Pattern } from '../../api/types'
import { RhythmStaff } from '../../components/RhythmStaff'
import { totalBeats } from '../../lib/rhythm'

const EMPTY_FORM: ExercisePayload = {
  title: '',
  description: '',
  level: 1,
  concept: 'note-values',
  learn_section: 'note-values',
  time_sig_top: 4,
  time_sig_bottom: 4,
  num_measures: 1,
  tempo_bpm: 80,
  pattern: { events: [{ type: 'note', duration: 'q' }] },
  is_active: true,
}

const DEFAULT_PATTERN_TEXT = JSON.stringify(EMPTY_FORM.pattern, null, 2)

function parsePattern(text: string): { pattern: Pattern | null; error: string | null } {
  try {
    const parsed = JSON.parse(text) as Pattern
    if (!parsed || !Array.isArray(parsed.events) || parsed.events.length === 0) {
      return { pattern: null, error: 'Pattern must be an object with a non-empty "events" array.' }
    }
    return { pattern: parsed, error: null }
  } catch {
    return { pattern: null, error: 'Pattern is not valid JSON.' }
  }
}

export function ExerciseManager() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<ExercisePayload>(EMPTY_FORM)
  const [patternText, setPatternText] = useState(DEFAULT_PATTERN_TEXT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function load() {
    api.admin
      .listExercises()
      .then(setExercises)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercises'))
  }

  useEffect(load, [])

  const parsed = useMemo(() => parsePattern(patternText), [patternText])
  const expectedBeats = form.num_measures * form.time_sig_top * (4 / form.time_sig_bottom)
  const actualBeats = parsed.pattern ? totalBeats(parsed.pattern) : null

  function startCreate() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    setPatternText(DEFAULT_PATTERN_TEXT)
    setSaveError(null)
  }

  function startEdit(exercise: Exercise) {
    setEditingId(exercise.id)
    setForm({
      title: exercise.title,
      description: exercise.description,
      level: exercise.level,
      concept: exercise.concept,
      learn_section: exercise.learn_section,
      time_sig_top: exercise.time_sig_top,
      time_sig_bottom: exercise.time_sig_bottom,
      num_measures: exercise.num_measures,
      tempo_bpm: exercise.tempo_bpm,
      pattern: exercise.pattern,
      is_active: exercise.is_active,
    })
    setPatternText(JSON.stringify(exercise.pattern, null, 2))
    setSaveError(null)
  }

  async function handleSave() {
    if (!parsed.pattern) {
      setSaveError(parsed.error)
      return
    }
    setSaving(true)
    setSaveError(null)
    const payload = { ...form, pattern: parsed.pattern }
    try {
      if (editingId === 'new') {
        await api.admin.createExercise(payload)
      } else if (typeof editingId === 'number') {
        await api.admin.updateExercise(editingId, payload)
      }
      setEditingId(null)
      load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(exercise: Exercise) {
    if (!window.confirm(`Deactivate “${exercise.title}”? Students will no longer see it.`)) {
      return
    }
    try {
      await api.admin.deleteExercise(exercise.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (error) {
    return <p className="error-text">{error}</p>
  }
  if (!exercises) {
    return <p className="page-loading">Loading exercises…</p>
  }

  return (
    <div>
      {editingId === null && (
        <>
          <p>
            <button type="button" className="button-primary" onClick={startCreate}>
              New exercise
            </button>
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Level</th>
                <th>Concept</th>
                <th>Time</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.id}>
                  <td>{exercise.title}</td>
                  <td>{exercise.level}</td>
                  <td>{exercise.concept}</td>
                  <td>
                    {exercise.time_sig_top}/{exercise.time_sig_bottom} × {exercise.num_measures}
                  </td>
                  <td>{exercise.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => startEdit(exercise)}>
                      Edit
                    </button>{' '}
                    {exercise.is_active && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void handleDeactivate(exercise)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editingId !== null && (
        <div className="card">
          <h2>{editingId === 'new' ? 'New exercise' : `Edit “${form.title}”`}</h2>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="ex-title">Title</label>
              <input
                id="ex-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ex-level">Level</label>
              <input
                id="ex-level"
                type="number"
                min={1}
                max={20}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="ex-description">Description</label>
            <input
              id="ex-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="ex-concept">Concept</label>
              <input
                id="ex-concept"
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ex-learn">Learn section slug</label>
              <input
                id="ex-learn"
                value={form.learn_section}
                onChange={(e) => setForm({ ...form, learn_section: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="ex-top">Beats per measure</label>
              <input
                id="ex-top"
                type="number"
                min={1}
                max={12}
                value={form.time_sig_top}
                onChange={(e) => setForm({ ...form, time_sig_top: Number(e.target.value) })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ex-bottom">Beat unit</label>
              <select
                id="ex-bottom"
                value={form.time_sig_bottom}
                onChange={(e) => setForm({ ...form, time_sig_bottom: Number(e.target.value) })}
              >
                <option value={2}>2 (half note)</option>
                <option value={4}>4 (quarter note)</option>
                <option value={8}>8 (eighth note)</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="ex-measures">Measures</label>
              <input
                id="ex-measures"
                type="number"
                min={1}
                max={8}
                value={form.num_measures}
                onChange={(e) => setForm({ ...form, num_measures: Number(e.target.value) })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="ex-tempo">Playback tempo (BPM)</label>
              <input
                id="ex-tempo"
                type="number"
                min={30}
                max={240}
                value={form.tempo_bpm}
                onChange={(e) => setForm({ ...form, tempo_bpm: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="ex-pattern">
              Pattern JSON ({actualBeats ?? '?'} of {expectedBeats} beats filled)
            </label>
            <textarea
              id="ex-pattern"
              rows={10}
              value={patternText}
              onChange={(e) => setPatternText(e.target.value)}
            />
          </div>
          {parsed.error && <p className="form-error">{parsed.error}</p>}
          {parsed.pattern && (
            <RhythmStaff
              pattern={parsed.pattern}
              timeSigTop={form.time_sig_top}
              timeSigBottom={form.time_sig_bottom}
              caption="Live preview"
            />
          )}
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="player-controls">
            <button
              type="button"
              className="button-primary"
              onClick={() => void handleSave()}
              disabled={saving || !parsed.pattern}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
