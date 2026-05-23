interface MetronomeProps {
  bpm: number
  running: boolean
}

/**
 * An old-school pyramid metronome. The pendulum swings side to side while `running`,
 * completing one full left-right-left cycle every two beats so it reaches an extreme
 * on each click.
 */
export function Metronome({ bpm, running }: MetronomeProps) {
  const cycleMs = (60000 / bpm) * 2
  return (
    <div className="metronome" data-testid="metronome" data-running={running}>
      <svg viewBox="0 0 100 130" width="76" height="99" role="img" aria-label="Metronome">
        {/* body */}
        <path d="M33 8 L67 8 L86 112 L14 112 Z" fill="#8a5a36" stroke="#5f3c22" strokeWidth="2" />
        {/* face plate */}
        <path d="M40 18 L60 18 L70 100 L30 100 Z" fill="#f3e7d3" stroke="#cdb997" strokeWidth="1.5" />
        {/* tempo graduations */}
        {[30, 44, 58, 72, 86].map((y) => (
          <line key={y} x1="46" y1={y} x2="54" y2={y} stroke="#a8987c" strokeWidth="1.5" />
        ))}
        {/* pendulum: pivots at the bottom, weight rides on the rod */}
        <g
          className={`metronome-pendulum${running ? ' swinging' : ''}`}
          style={{ animationDuration: `${cycleMs}ms` }}
        >
          <line x1="50" y1="104" x2="50" y2="14" stroke="#2e2a26" strokeWidth="3" strokeLinecap="round" />
          <path d="M43 34 L57 34 L54 48 L46 48 Z" fill="#caa44a" stroke="#8f7330" strokeWidth="1.5" />
        </g>
        {/* pivot pin */}
        <circle cx="50" cy="104" r="4" fill="#5f3c22" />
        {/* base */}
        <rect x="8" y="112" width="84" height="12" rx="3" fill="#5f3c22" />
      </svg>
      <span className="metronome-bpm">{bpm} BPM</span>
    </div>
  )
}
