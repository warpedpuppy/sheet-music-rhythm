import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        ♩ Rhythm Trainer
      </Link>
      <nav className="navbar-links">
        {user && (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/exercises">Exercises</NavLink>
          </>
        )}
        <NavLink to="/learn">Learn</NavLink>
        {user?.is_admin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="navbar-user">
        {user ? (
          <>
            <span className="navbar-username">{user.username}</span>
            <button type="button" className="link-button" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register" className="button-primary small">
              Sign up
            </NavLink>
          </>
        )}
      </div>
    </header>
  )
}
