import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AdminRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { NavBar } from './components/NavBar'
import { Admin } from './pages/admin/Admin'
import { Dashboard } from './pages/Dashboard'
import { ExerciseList } from './pages/ExerciseList'
import { ExercisePlayer } from './pages/ExercisePlayer'
import { Home } from './pages/Home'
import { Learn } from './pages/Learn'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <main className="page">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/learn" element={<Learn />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exercises"
              element={
                <ProtectedRoute>
                  <ExerciseList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exercises/:id"
              element={
                <ProtectedRoute>
                  <ExercisePlayer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
