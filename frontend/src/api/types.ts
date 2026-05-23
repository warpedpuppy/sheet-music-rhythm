export type Duration = 'w' | 'h' | 'q' | '8' | '16'

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
  unlocked_level: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface UserExerciseStatus {
  passed: boolean
  best_accuracy: number | null
  attempts_count: number
  locked: boolean
}

export interface Exercise {
  id: number
  title: string
  difficulty: number
  time_signature: string
  tempo_bpm: number
  num_measures: number
  pattern: Pattern
  concept_tags: string[]
  learn_section_slug: string | null
  user_status: UserExerciseStatus | null
}

export type NoteStatus = 'hit' | 'early' | 'late' | 'missed'

export interface NoteResult {
  index: number
  expected_ms: number
  status: NoteStatus
  tap_ms: number | null
  delta_ms: number | null
}

export interface ProgressionInfo {
  unlocked_level: number
  leveled_up: boolean
  remediation_started: boolean
  remediation_resolved: boolean
  suggestion: string | null
}

export interface AttemptResult {
  attempt_id: number
  gave_up: boolean
  results: NoteResult[]
  accuracy: number | null
  passed: boolean
  detected_tempo_bpm: number | null
  played_pattern: Pattern | null
  progression: ProgressionInfo
}

export interface AttemptSummary {
  id: number
  exercise_id: number
  accuracy: number | null
  passed: boolean
  gave_up: boolean
  created_at: string
}

export interface LevelProgress {
  difficulty: number
  passed_count: number
  total: number
}

export interface ConceptMastery {
  concept: string
  mastery: number
  attempts: number
}

export interface RemediationInfo {
  source_exercise_id: number
  source_exercise_title: string
  passes_done: number
  passes_required: number
}

export interface Progress {
  unlocked_level: number
  per_level: LevelProgress[]
  concepts: ConceptMastery[]
  active_remediation: RemediationInfo | null
}

export type NextReason = 'progression' | 'remediation' | 'retry-original' | 'practice' | 'completed'

export interface NextExercise {
  exercise: Exercise | null
  reason: NextReason
  source_exercise_id: number | null
  source_exercise_title: string | null
}

export interface AdminUser {
  id: number
  username: string
  is_admin: boolean
  unlocked_level: number
  total_attempts: number
  exercises_passed: number
  last_active: string | null
}

export interface AdminUserProgress {
  user: User
  progress: Progress
  recent_attempts: AttemptSummary[]
}

export interface ExerciseInput {
  title: string
  difficulty: number
  time_signature: string
  tempo_bpm: number
  num_measures: number
  pattern: Pattern
  concept_tags: string[]
  learn_section_slug: string | null
}

export interface TestCaseResult {
  nodeid: string
  outcome: string
  duration: number
  message: string | null
}

export interface TestRunSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  duration_s: number
}

export type TestRunState = 'running' | 'passed' | 'failed' | 'error' | 'timeout'

export interface TestRun {
  run_id: string
  suite: string
  status: TestRunState
  summary: TestRunSummary | null
  tests: TestCaseResult[]
  raw_output_tail: string | null
}
