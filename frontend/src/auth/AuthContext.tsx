import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (getToken()) {
      api
        .me()
        .then((me) => {
          if (!cancelled) setUser(me)
        })
        .catch(() => {
          if (!cancelled) setUser(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    } else {
      setLoading(false)
    }
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => {
      cancelled = true
      window.removeEventListener('auth:logout', onLogout)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    const response = await api.register(username, password)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getToken()) return
    try {
      setUser(await api.me())
    } catch {
      // token expired; the 401 handler clears it
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
