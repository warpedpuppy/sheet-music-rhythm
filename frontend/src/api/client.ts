import type {
  AdminUser,
  AdminUserProgress,
  AttemptResult,
  AttemptSummary,
  Exercise,
  ExerciseInput,
  NextExercise,
  Progress,
  TestRun,
  TokenResponse,
  User,
} from './types'

const TOKEN_KEY = 'rhythm_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (response.status === 401) {
    setToken(null)
    window.dispatchEvent(new Event('auth:logout'))
  }
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail[0].msg
      }
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export const api = {
  register: (username: string, password: string) =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>('/auth/me'),

  listExercises: () => request<Exercise[]>('/exercises'),
  getExercise: (id: number) => request<Exercise>(`/exercises/${id}`),

  submitAttempt: (exerciseId: number, tapsMs: number[], gaveUp = false) =>
    request<AttemptResult>('/attempts', {
      method: 'POST',
      body: JSON.stringify({ exercise_id: exerciseId, taps_ms: tapsMs, gave_up: gaveUp }),
    }),
  listAttempts: (exerciseId?: number) =>
    request<AttemptSummary[]>(`/attempts${exerciseId ? `?exercise_id=${exerciseId}` : ''}`),

  getProgress: () => request<Progress>('/progress'),
  getNextExercise: () => request<NextExercise>('/next-exercise'),

  admin: {
    listUsers: () => request<AdminUser[]>('/admin/users'),
    getUserProgress: (userId: number) => request<AdminUserProgress>(`/admin/users/${userId}/progress`),
    createExercise: (payload: ExerciseInput) =>
      request<Exercise>('/admin/exercises', { method: 'POST', body: JSON.stringify(payload) }),
    updateExercise: (id: number, payload: ExerciseInput) =>
      request<Exercise>(`/admin/exercises/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteExercise: (id: number) =>
      request<void>(`/admin/exercises/${id}`, { method: 'DELETE' }),
    startTestRun: (suite: 'backend' | 'frontend') =>
      request<TestRun>('/admin/test-run', { method: 'POST', body: JSON.stringify({ suite }) }),
    getTestRun: (runId: string) => request<TestRun>(`/admin/test-run/${runId}`),
  },
}
