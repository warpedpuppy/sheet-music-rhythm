export type Duration = 'w' | 'h' | 'q' | '8' | '16'
export type Verdict = 'on_time' | 'early' | 'late' | 'wrong' | 'missed'

export interface PatternEvent {
  type: 'note' | 'rest'
  duration: Duration
  dots?: number
  tieToNext?: boolean
}

export interface Pattern {
  events: PatternEvent[]
}

export interface User {
  id: number
  username: string
  is_admin: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ExerciseListItem {
  id: number
  title: string
  description: string
  level: number
  concept: string
  learn_section: string
  time_sig_top: number
  time_sig_bottom: number
  num_measures: number
  locked: boolean
  passed: boolean
  attempt_count: number
}

export interface Exercise {
  id: number
  title: string
  description: string
  level: number
  concept: string
  learn_section: string
  time_sig_top: number
  time_sig_bottom: number
  num_measures: number
  tempo_bpm: number
  pattern: Pattern
  is_active: boolean
  tap_count: number
}

export interface NoteResult {
  index: number
  expected_beat: number
  actual_beat: number | null
  deviation_beats: number | null
  verdict: Verdict
}

export type AttemptMode = 'free' | 'strict'

export interface AttemptResult {
  attempt_id: number
  passed: boolean
  gave_up: boolean
  mode: AttemptMode
  accuracy: number
  note_results: NoteResult[]
  inferred_bpm: number | null
  unlocked_level: number
  newly_unlocked_level: number | null
  remediation_started: boolean
  remediation_active: boolean
  message: string
}

export interface ConceptMastery {
  concept: string
  passes: number
  fails: number
  mastered: boolean
}

export interface ProgressSummary {
  unlocked_level: number
  max_level: number
  total_attempts: number
  total_passed_exercises: number
  total_exercises: number
  concepts: ConceptMastery[]
  remediation_active: boolean
  remediation_concept: string | null
}

export interface NextExercise {
  exercise_id: number | null
  title: string | null
  level: number | null
  reason: 'progression' | 'remediation' | 'complete'
  message: string
}

export interface AdminUser {
  id: number
  username: string
  is_admin: boolean
  created_at: string
  unlocked_level: number
  total_attempts: number
  passed_exercises: number
}

export interface AdminAttempt {
  id: number
  exercise_id: number
  exercise_title: string
  accuracy: number
  passed: boolean
  gave_up: boolean
  mode: AttemptMode
  created_at: string
}

export interface AdminUserDetail extends AdminUser {
  concepts: ConceptMastery[]
  recent_attempts: AdminAttempt[]
}

export interface ExercisePayload {
  title: string
  description: string
  level: number
  concept: string
  learn_section: string
  time_sig_top: number
  time_sig_bottom: number
  num_measures: number
  tempo_bpm: number
  pattern: Pattern
  is_active?: boolean
}

export interface TestCaseResult {
  name: string
  outcome: string
  duration_ms: number | null
  message: string | null
}

export interface TestRunStatus {
  suite: string | null
  status: 'idle' | 'running' | 'finished' | 'error'
  started_at: string | null
  finished_at: string | null
  summary: Record<string, number> | null
  cases: TestCaseResult[]
  error: string | null
  raw_output: string | null
}
