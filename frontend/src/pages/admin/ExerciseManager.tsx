import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Exercise, ExerciseInput, Pattern } from '../../api/types'
import { RhythmStaff } from '../../components/RhythmStaff'

const LEARN_SLUGS = [
  '',
  'time-signatures',
  'note-values',
  'counting',
  'eighth-notes',
  'sixteenth-notes',
  'rests',
  'dotted-notes',
  'ties',
  'beams',
  'tempo',
  'syncopation',
  'simple-vs-compound',
]

const EMPTY_FORM: ExerciseInput = {
  title: '',
  difficulty: 1,
  time_signature: '4/4',
  tempo_bpm: 80,
  num_measures: 2,
  pattern: { events: [{ type: 'note', duration: 'q' }] },
  concept_tags: [],
  learn_section_slug: null,
}

function parsePattern(text: string): Pattern | null {
  try {
    const parsed = JSON.parse(text)
    if (parsed && Array.isArray(parsed.events)) {
      return parsed as Pattern
    }
    return null
  } catch {
    return null
  }
}

export function ExerciseManager() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [form, setForm] = useState<ExerciseInput>(EMPTY_FORM)
  const [patternText, setPatternText] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    api
      .listExercises()
      .then(setExercises)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercises'))
  }

  useEffect(load, [])

  const startEdit = (exercise: Exercise | 'new') => {
    setEditing(exercise)
    setMessage(null)
    setError(null)
    if (exercise === 'new') {
      setForm(EMPTY_FORM)
      setPatternText(JSON.stringify(EMPTY_FORM.pattern, null, 2))
      setTagsText('')
    } else {
      setForm({
        title: exercise.title,
        difficulty: exercise.difficulty,
        time_signature: exercise.time_signature,
        tempo_bpm: exercise.tempo_bpm,
        num_measures: exercise.num_measures,
        pattern: exercise.pattern,
        concept_tags: exercise.concept_tags,
        learn_section_slug: exercise.learn_section_slug,
      })
      setPatternText(JSON.stringify(exercise.pattern, null, 2))
      setTagsText(exercise.concept_tags.join(', '))
    }
  }

  const previewPattern = useMemo(() => parsePattern(patternText), [patternText])

  const handleSave = async () => {
    setError(null)
    setMessage(null)
    const pattern = parsePattern(patternText)
    if (!pattern) {
      setError('Pattern is not valid JSON with an "events" array.')
      return
    }
    const payload: ExerciseInput = {
      ...form,
      pattern,
      concept_tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      learn_section_slug: form.learn_section_slug || null,
    }
    try {
      if (editing === 'new') {
        await api.admin.createExercise(payload)
        setMessage('Exercise created.')
      } else if (editing) {
        await api.admin.updateExercise(editing.id, payload)
        setMessage('Exercise updated.')
      }
      setEditing(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise')
    }
  }

  const handleDelete = async (exercise: Exercise) => {
    if (!window.confirm(`Delete "${exercise.title}"? Students will no longer see it.`)) return
    try {
      await api.admin.deleteExercise(exercise.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete exercise')
    }
  }

  if (!exercises) return <div className="page-loading">Loading exercises…</div>

  return (
    <div className="admin-exercises">
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {editing === null ? (
        <>
          <div className="admin-toolbar">
            <button type="button" className="btn btn-primary" onClick={() => startEdit('new')}>
              New exercise
            </button>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Level</th>
                <th>Time</th>
                <th>Tempo</th>
                <th>Concepts</th>
                <th>Learn link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.id}>
                  <td>{exercise.title}</td>
                  <td>{exercise.difficulty}</td>
                  <td>{exercise.time_signature}</td>
                  <td>{exercise.tempo_bpm} BPM</td>
                  <td>{exercise.concept_tags.join(', ')}</td>
                  <td>{exercise.learn_section_slug ?? '—'}</td>
                  <td className="admin-row-actions">
                    <button type="button" className="btn btn-small" onClick={() => startEdit(exercise)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(exercise)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="card exercise-editor">
          <h3>{editing === 'new' ? 'New exercise' : `Edit: ${form.title}`}</h3>
          <div className="editor-grid">
            <label>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Difficulty (level)
              <input
                type="number"
                min={1}
                max={20}
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}
              />
            </label>
            <label>
              Time signature
              <select
                value={form.time_signature}
                onChange={(e) => setForm({ ...form, time_signature: e.target.value })}
              >
                <option>4/4</option>
                <option>3/4</option>
                <option>2/4</option>
              </select>
            </label>
            <label>
              Tempo (BPM)
              <input
                type="number"
                min={30}
                max={240}
                value={form.tempo_bpm}
                onChange={(e) => setForm({ ...form, tempo_bpm: Number(e.target.value) })}
              />
            </label>
            <label>
              Measures
              <input
                type="number"
                min={1}
                max={16}
                value={form.num_measures}
                onChange={(e) => setForm({ ...form, num_measures: Number(e.target.value) })}
              />
            </label>
            <label>
              Learn section
              <select
                value={form.learn_section_slug ?? ''}
                onChange={(e) => setForm({ ...form, learn_section_slug: e.target.value || null })}
              >
                {LEARN_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug || '(none)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-wide">
              Concept tags (comma separated)
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="quarter-notes, rests"
              />
            </label>
            <label className="editor-wide">
              Pattern JSON
              <textarea
                rows={10}
                value={patternText}
                onChange={(e) => setPatternText(e.target.value)}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="editor-preview">
            <h4>Preview</h4>
            {previewPattern ? (
              <RhythmStaff pattern={previewPattern} timeSignature={form.time_signature} height={130} />
            ) : (
              <p className="form-error">Pattern JSON is invalid.</p>
            )}
          </div>

          <div className="editor-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
