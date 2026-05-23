import type {
  AdminUser,
  AdminUserDetail,
  AttemptResult,
  Exercise,
  ExerciseListItem,
  ExercisePayload,
  NextExercise,
  ProgressSummary,
  TestRunStatus,
  TokenResponse,
  User,
} from './types'

const TOKEN_KEY = 'rhythm-trainer-token'

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
    ...((options.headers as Record<string, string>) ?? {}),
  }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail[0].msg
      }
    } catch {
      // keep the generic message
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
    request<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>('/api/auth/me'),

  listExercises: () => request<ExerciseListItem[]>('/api/exercises'),
  getExercise: (id: number) => request<Exercise>(`/api/exercises/${id}`),
  submitAttempt: (exerciseId: number, tapsMs: number[], gaveUp: boolean) =>
    request<AttemptResult>(`/api/exercises/${exerciseId}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ taps_ms: tapsMs, gave_up: gaveUp }),
    }),

  getProgress: () => request<ProgressSummary>('/api/progress'),
  getNextExercise: () => request<NextExercise>('/api/progress/next'),

  admin: {
    listUsers: () => request<AdminUser[]>('/api/admin/users'),
    getUser: (id: number) => request<AdminUserDetail>(`/api/admin/users/${id}`),
    listExercises: () => request<Exercise[]>('/api/admin/exercises'),
    createExercise: (payload: ExercisePayload) =>
      request<Exercise>('/api/admin/exercises', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateExercise: (id: number, payload: ExercisePayload) =>
      request<Exercise>(`/api/admin/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteExercise: (id: number) =>
      request<void>(`/api/admin/exercises/${id}`, { method: 'DELETE' }),
    runTests: (suite: 'backend' | 'frontend') =>
      request<TestRunStatus>('/api/admin/tests/run', {
        method: 'POST',
        body: JSON.stringify({ suite }),
      }),
    testStatus: () => request<TestRunStatus>('/api/admin/tests/status'),
  },
}
