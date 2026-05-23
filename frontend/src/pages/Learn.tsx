import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { Pattern } from '../api/types'
import { NotationExample } from '../components/NotationExample'

interface LearnSection {
  slug: string
  title: string
  body: ReactNode
}

const p = (events: Pattern['events']): Pattern => ({ events })

export const LEARN_SECTIONS: LearnSection[] = [
  {
    slug: 'reading-rhythm',
    title: 'How to read rhythm (start here)',
    body: (
      <>
        <p>
          Rhythm is the part of sheet music that tells you <em>when</em> to play and{' '}
          <em>how long</em> each sound lasts. You can ignore pitch entirely and still read
          rhythm — which is exactly what this trainer does. Every exercise is written on a
          single line because only the horizontal dimension (time) matters here.
        </p>
        <p>
          Music is divided into <strong>beats</strong> — the steady pulse you tap your foot
          to. Notes are symbols that occupy some number of beats. Reading rhythm means
          looking at a string of symbols and knowing the proportions between them: this one
          is twice as long as that one, this one falls halfway between two beats, and so on.
        </p>
        <p>
          In the exercises, you tap the <strong>spacebar</strong> once for every note, at
          the moment the note begins. You choose the speed; the trainer only checks that
          the <em>proportions</em> between your taps match the notation. Never tap during
          a rest, and never tap the second note of a tie — more on both below.
        </p>
      </>
    ),
  },
  {
    slug: 'note-values',
    title: 'Note values: whole, half, quarter',
    body: (
      <>
        <p>
          Each note shape stands for a duration. The <strong>whole note</strong> (a hollow
          oval with no stem) is the longest common value: four beats. The{' '}
          <strong>half note</strong> (hollow, with a stem) lasts two beats. The{' '}
          <strong>quarter note</strong> (filled, with a stem) lasts one beat — in most
          music the quarter note <em>is</em> the beat.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'w' },
            { type: 'note', duration: 'h' },
            { type: 'note', duration: 'h' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
          ])}
          timeSigTop={4}
          timeSigBottom={4}
          caption="One whole note = two half notes = four quarter notes. Each measure here adds up to four beats."
        />
        <p>
          The crucial skill: a half note isn't just "a longer note" — it is{' '}
          <em>exactly twice</em> a quarter note. When you tap a half note followed by two
          quarters, the gap after your first tap must be exactly twice as long as the gap
          after your second.
        </p>
      </>
    ),
  },
  {
    slug: 'time-signatures',
    title: 'Time signatures & measures',
    body: (
      <>
        <p>
          The two stacked numbers at the start of a piece are the{' '}
          <strong>time signature</strong>. The top number says how many beats are in each{' '}
          <strong>measure</strong> (the space between two vertical barlines); the bottom
          number says which note value gets one beat. <strong>4/4</strong> means four
          quarter-note beats per measure. <strong>3/4</strong> — waltz time — means three.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'h' },
            { type: 'note', duration: 'q' },
          ])}
          timeSigTop={3}
          timeSigBottom={4}
          caption="Two measures of 3/4. Each measure contains exactly three beats: ONE-two-three | ONE-two-three."
        />
        <p>
          Measures are bookkeeping: the notes inside every measure must add up to exactly
          the number of beats the time signature promises. When you read a new rhythm,
          checking that each measure adds up is the fastest way to make sure you've
          understood every symbol in it.
        </p>
      </>
    ),
  },
  {
    slug: 'rests',
    title: 'Rests: the notes you don’t play',
    body: (
      <>
        <p>
          A <strong>rest</strong> is measured silence. Every note value has a matching
          rest: the whole rest hangs below a staff line, the half rest sits on top of one,
          the quarter rest is the squiggle, and the eighth rest looks like a small flag.
          Rests take up time exactly like notes do — you just don't tap them.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'q' },
            { type: 'rest', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
          ])}
          caption="Tap, silence, tap, tap. The rest on beat two still takes a full beat — count it, don't tap it."
        />
        <p>
          The discipline rests teach is <em>counting through silence</em>. Beginners rush
          rests because nothing is happening. Keep the pulse going in your head during the
          rest so the next note lands exactly where it should.
        </p>
      </>
    ),
  },
  {
    slug: 'eighth-notes',
    title: 'Eighth notes & beaming',
    body: (
      <>
        <p>
          An <strong>eighth note</strong> lasts half a beat, so two of them fit evenly
          inside one quarter-note beat. On its own an eighth note has a flag on its stem;
          when several appear in a row they are joined by a <strong>beam</strong> — a
          thick horizontal bar — to make the beat groupings easy to see.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'q' },
            { type: 'note', duration: '8' },
            { type: 'note', duration: '8' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: '8' },
            { type: 'note', duration: '8' },
          ])}
          caption='Say it out loud: "walk run-run walk run-run". The beamed pairs each fit inside one beat.'
        />
        <p>
          A useful habit is to count eighth notes with "and": <em>one-and-two-and…</em>.
          The numbers fall on the beats and the "and"s fall exactly halfway between them.
        </p>
      </>
    ),
  },
  {
    slug: 'dotted-notes',
    title: 'Dotted notes',
    body: (
      <>
        <p>
          A small dot after a note head adds <strong>half the note's own value</strong> to
          its length. A dotted half note is 2 + 1 = 3 beats. A dotted quarter is 1 + ½ =
          1½ beats. The most common dotted figure by far is the{' '}
          <strong>dotted quarter followed by an eighth</strong>: a long-short pair that
          adds up to exactly two beats.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'q', dots: 1 },
            { type: 'note', duration: '8' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
          ])}
          caption="LONG-short, walk, walk. The dotted quarter takes one and a half beats; the eighth takes the remaining half."
        />
        <p>
          When tapping, the giveaway of a correct dotted rhythm is the <em>snap</em> of the
          short note arriving late in the beat — three times as much time passes after the
          dotted note as after the eighth that follows it.
        </p>
      </>
    ),
  },
  {
    slug: 'ties',
    title: 'Ties',
    body: (
      <>
        <p>
          A <strong>tie</strong> is a curved line connecting two notes <em>of the same
          pitch</em>. It glues their durations together into one longer sound: you play the
          first note and simply keep holding through the second. Ties exist to write
          durations that cross a barline or that no single symbol can express.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q', tieToNext: true },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'h' },
          ])}
          timeSigTop={4}
          timeSigBottom={4}
          caption="The tie joins beat four of the first measure to beat one of the second — one tap, held for two beats across the barline."
        />
        <p>
          <strong>In the exercises, never tap the second note of a tie.</strong> It is the
          continuation of a sound you already started. A tie is not a slur (which connects
          different pitches and is about phrasing, not duration) — in a rhythm-only
          context, a curved line always means "hold".
        </p>
      </>
    ),
  },
  {
    slug: 'sixteenths',
    title: 'Sixteenth notes',
    body: (
      <>
        <p>
          A <strong>sixteenth note</strong> lasts a quarter of a beat — four of them fill
          one beat. They carry two flags, or a double beam when grouped. Mixed groups of
          eighths and sixteenths create most of the rhythmic vocabulary you'll meet in real
          music.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: '16' },
            { type: 'note', duration: '16' },
            { type: 'note', duration: '16' },
            { type: 'note', duration: '16' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: '8' },
            { type: 'note', duration: '8' },
            { type: 'note', duration: 'q' },
          ])}
          caption='Count a beat of sixteenths as "one-e-and-a". Here: run-run-run-run, walk, jog-jog, walk.'
        />
        <p>
          Keep sixteenths light and absolutely even. The most common mistake is letting
          them swing or rushing the last one to get back to the beat.
        </p>
      </>
    ),
  },
  {
    slug: 'syncopation',
    title: 'Syncopation',
    body: (
      <>
        <p>
          <strong>Syncopation</strong> means putting emphasis where the listener doesn't
          expect it — on the weak part of the beat, or between beats — and then{' '}
          <em>holding</em> through the strong beat that follows. It's what makes rhythm
          feel like groove instead of a metronome.
        </p>
        <NotationExample
          pattern={p([
            { type: 'note', duration: '8' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: 'q' },
            { type: 'note', duration: '8' },
          ])}
          caption="Short-LONG-LONG-LONG-short. The quarter notes all land off the beat — that off-balance feeling is syncopation."
        />
        <p>
          The classic example is the <strong>Charleston</strong> figure: a dotted quarter
          followed by a note that is tied over the next strong beat. To tap syncopation
          accurately, keep the underlying pulse rock-steady in your head and let your taps
          deliberately miss it.
        </p>
      </>
    ),
  },
]

export function Learn() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1))
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  return (
    <div>
      <h1>The rhythm guide</h1>
      <p className="muted">
        Everything the exercises practice, explained with notation. Every exercise links to
        the section that covers its concept.
      </p>
      <div className="learn-layout">
        <nav className="learn-toc" aria-label="Sections">
          {LEARN_SECTIONS.map((section) => (
            <a key={section.slug} href={`#${section.slug}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <div>
          {LEARN_SECTIONS.map((section) => (
            <section key={section.slug} id={section.slug} className="learn-section">
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
