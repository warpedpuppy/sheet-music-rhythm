import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Home() {
  const { user } = useAuth()

  return (
    <div className="home">
      <section className="hero-section">
        <h1>Learn to read rhythm.</h1>
        <p className="hero-subtitle">
          See the notation, feel the beat, and tap it out on the spacebar. Rhythm Trainer listens
          to your timing, scores every note, and adapts the exercises to exactly what you need to
          practice next.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-large">
              Continue practicing
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-large">
                Get started
              </Link>
              <Link to="/login" className="btn btn-large">
                Log in
              </Link>
            </>
          )}
          <Link to="/learn" className="btn btn-large">
            Read the rhythm guide
          </Link>
        </div>
      </section>

      <section className="home-features">
        <div className="feature-card">
          <h3>Tap along</h3>
          <p>
            Read the printed rhythm and tap it out on the spacebar at your own speed — every tap
            ticks back at you. You get note-by-note feedback: on time, early, late, or missed.
          </p>
        </div>
        <div className="feature-card">
          <h3>Progress at your pace</h3>
          <p>
            Pass exercises to unlock harder levels — from steady quarter notes all the way to
            dotted rhythms, sixteenths, ties, and syncopation. Struggling with one? We will suggest
            similar exercises until it clicks.
          </p>
        </div>
        <div className="feature-card">
          <h3>Hear the answer</h3>
          <p>
            Stuck? Press “I give up” and the app ticks the correct rhythm out loud while a dot
            bounces over each note, so you can connect what you see with what you should hear.
          </p>
        </div>
      </section>
    </div>
  )
}
