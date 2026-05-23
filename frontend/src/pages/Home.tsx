import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Home() {
  const { user } = useAuth()
  return (
    <div>
      <section className="hero-section">
        <h1>Learn to read rhythm, one tap at a time.</h1>
        <p>
          Each exercise shows you real sheet music. Tap the rhythm on your spacebar at
          whatever speed feels right — the trainer listens, tells you exactly which notes
          you rushed or dragged, and gets gradually harder as you improve.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/dashboard" className="button-primary">
              Go to your dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className="button-primary">
                Create a free account
              </Link>
              <Link to="/login" className="button-secondary">
                Log in
              </Link>
            </>
          )}
          <Link to="/learn" className="button-secondary">
            Read the rhythm guide
          </Link>
        </div>
      </section>
      <section className="feature-grid">
        <div className="card">
          <h3>Tap, don't type</h3>
          <p>
            The spacebar is your instrument. Every tap clicks back at you, and the attempt
            ends the moment you've tapped every note on the page.
          </p>
        </div>
        <div className="card">
          <h3>It adapts to you</h3>
          <p>
            Pass exercises to unlock harder levels. Get stuck, and the trainer quietly
            lines up similar, friendlier rhythms until you've mastered the idea.
          </p>
        </div>
        <div className="card">
          <h3>Stuck? Give up gracefully</h3>
          <p>
            The “I give up” button ticks the correct rhythm out loud while a dot bounces
            across the notes, so you can hear exactly what the page is asking for.
          </p>
        </div>
        <div className="card">
          <h3>Theory when you want it</h3>
          <p>
            Every exercise links to the section of the rhythm guide that explains the
            concept it practices — dotted notes, ties, syncopation and all.
          </p>
        </div>
      </section>
    </div>
  )
}
