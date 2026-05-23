import { Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { AdminRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ExerciseList } from './pages/ExerciseList'
import { ExercisePlayer } from './pages/ExercisePlayer'
import { Learn } from './pages/Learn'
import { Admin } from './pages/Admin'

function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="app-main">
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
    </div>
  )
}

export default App
