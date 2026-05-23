import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return <p className="page-loading">Loading…</p>
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <p className="page-loading">Loading…</p>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
