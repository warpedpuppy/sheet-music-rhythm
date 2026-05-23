import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        ♩ Rhythm Trainer
      </Link>
      <nav className="navbar-links">
        {user ? (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/exercises">Exercises</NavLink>
            <NavLink to="/learn">Learn</NavLink>
            {user.is_admin && <NavLink to="/admin">Admin</NavLink>}
            <span className="navbar-user">{user.username}</span>
            <button type="button" className="btn btn-small" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/learn">Learn</NavLink>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register" className="btn btn-small btn-primary">
              Sign up
            </NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
