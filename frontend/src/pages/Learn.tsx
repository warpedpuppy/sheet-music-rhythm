import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { Duration, Pattern, PatternEvent } from '../api/types'
import { NotationExample } from '../components/NotationExample'

function n(duration: Duration, dots = 0, tieToNext = false): PatternEvent {
  const event: PatternEvent = { type: 'note', duration }
  if (dots) event.dots = dots
  if (tieToNext) event.tieToNext = true
  return event
}

function r(duration: Duration): PatternEvent {
  return { type: 'rest', duration }
}

function p(...events: PatternEvent[]): Pattern {
  return { events }
}

interface Section {
  slug: string
  title: string
}

const SECTIONS: Section[] = [
  { slug: 'time-signatures', title: 'The staff, measures & time signatures' },
  { slug: 'note-values', title: 'Note values: whole, half & quarter notes' },
  { slug: 'counting', title: 'Counting and feeling the beat' },
  { slug: 'tempo', title: 'Tempo and the metronome' },
  { slug: 'eighth-notes', title: 'Eighth notes' },
  { slug: 'sixteenth-notes', title: 'Sixteenth notes' },
  { slug: 'beams', title: 'Beams and note groups' },
  { slug: 'rests', title: 'Rests: rhythm you don’t play' },
  { slug: 'dotted-notes', title: 'Dotted notes' },
  { slug: 'ties', title: 'Ties' },
  { slug: 'syncopation', title: 'Syncopation' },
  { slug: 'simple-vs-compound', title: 'Simple vs. compound meter' },
]

export function Learn() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.hash])

  return (
    <div className="learn-page">
      <aside className="learn-toc">
        <h2>Contents</h2>
        <ol>
          {SECTIONS.map((section) => (
            <li key={section.slug}>
              <a href={`#${section.slug}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </aside>

      <article className="learn-content">
        <h1>Reading rhythm in sheet music</h1>
        <p className="learn-intro">
          Rhythm is the part of music that lives in time: when notes start, how long they last, and
          when nothing happens at all. This guide walks through everything the exercises on this
          site will ask of you, from steady quarter notes to syncopated, tied rhythms. Every
          exercise links back to the section here that explains the idea it practices.
        </p>

        <section id="time-signatures" className="learn-section">
          <h2>The staff, measures &amp; time signatures</h2>
          <p>
            Music is written on a <strong>staff</strong> and divided into equal slices of time
            called <strong>measures</strong> (or bars), separated by vertical <strong>bar lines</strong>.
            Within a measure, time is counted in <strong>beats</strong> — the steady pulse you tap
            your foot to.
          </p>
          <p>
            The <strong>time signature</strong> at the start of a piece tells you how the beats are
            organized. The top number says how many beats are in each measure; the bottom number
            says which note value gets one beat. In <strong>4/4</strong> there are four beats per
            measure and the quarter note gets the beat. In <strong>3/4</strong> there are three
            beats per measure — the classic waltz feel. In <strong>2/4</strong> there are two, like
            a march.
          </p>
          <NotationExample
            timeSignature="4/4"
            pattern={p(n('q'), n('q'), n('q'), n('q'), n('q'), n('q'), n('q'), n('q'))}
            caption="Two measures of 4/4: four quarter-note beats in each measure, separated by a bar line."
          />
          <NotationExample
            timeSignature="3/4"
            pattern={p(n('q'), n('q'), n('q'), n('q'), n('q'), n('q'))}
            caption="Two measures of 3/4: count “1‑2‑3, 1‑2‑3.”"
          />
        </section>

        <section id="note-values" className="learn-section">
          <h2>Note values: whole, half &amp; quarter notes</h2>
          <p>
            A note&apos;s shape tells you how long it lasts. The three longest values you will meet
            first are:
          </p>
          <ul>
            <li>
              <strong>Whole note</strong> — an open note head with no stem. It lasts four beats: a
              full measure of 4/4.
            </li>
            <li>
              <strong>Half note</strong> — an open note head with a stem. It lasts two beats.
            </li>
            <li>
              <strong>Quarter note</strong> — a filled note head with a stem. It lasts one beat and
              is usually the note that “gets the beat.”
            </li>
          </ul>
          <p>
            Each value is exactly twice as long as the next one down: one whole note = two half
            notes = four quarter notes. When you tap these rhythms, you tap once at the{' '}
            <em>start</em> of each note and then let it “ring” for its full length — the skill is
            waiting the right amount of time before the next tap.
          </p>
          <NotationExample
            pattern={p(n('w'), n('h'), n('h'), n('q'), n('q'), n('q'), n('q'))}
            caption="A whole note (4 beats), two half notes (2 beats each), then four quarter notes (1 beat each)."
          />
        </section>

        <section id="counting" className="learn-section">
          <h2>Counting and feeling the beat</h2>
          <p>
            Musicians count out loud (or in their heads) to keep their place. In 4/4 you count{' '}
            <strong>“1, 2, 3, 4”</strong> — one number per beat — and start again in the next
            measure. A half note starting on beat 1 is counted “1 (2)”: you tap on 1 and stay
            silent while you count 2.
          </p>
          <p>
            In the exercises here you set your own speed: your first tap starts the clock, and what
            is judged is whether the <em>relationships</em> between your taps match the notation.
            Counting steadily in your head — “1, 2, 3, 4” — is what keeps long notes and rests
            honest. If you want to hear a rhythm against a steady pulse, press “I give up” and the
            app will tick it for you.
          </p>
          <NotationExample
            pattern={p(n('q'), n('q'), n('h'), n('h'), n('q'), n('q'))}
            caption="Count: “1, 2, 3‑(4), 1‑(2), 3, 4.” Tap only where a note starts."
          />
        </section>

        <section id="tempo" className="learn-section">
          <h2>Tempo and the metronome</h2>
          <p>
            <strong>Tempo</strong> is the speed of the beat, measured in <strong>beats per minute
            (BPM)</strong>. At 60 BPM each beat lasts exactly one second; at 120 BPM the beats come
            twice as fast. A <strong>metronome</strong> is the steady clicking device (or app) that
            sounds every beat — practicing with one is the best way to keep your pulse honest.
          </p>
          <p>
            The notation itself never changes with tempo: a quarter note is always one beat. What
            changes is how much clock time a beat takes. In the exercises here you choose your own
            tempo when you tap — the app detects it from your taps and judges the rhythm at that
            speed, so tapping slower is never penalized. The “I give up” playback uses each
            exercise&apos;s written tempo.
          </p>
        </section>

        <section id="eighth-notes" className="learn-section">
          <h2>Eighth notes</h2>
          <p>
            An <strong>eighth note</strong> has a filled head and a flag on its stem (or a beam
            connecting it to its neighbours). It lasts half a beat, so two eighth notes fit in the
            time of one quarter note.
          </p>
          <p>
            To count eighth notes, divide every beat in two: <strong>“1 &amp; 2 &amp; 3 &amp; 4
            &amp;”</strong> (say “and” for the second half of each beat). The numbers fall on the
            beats; the “ands” fall exactly halfway between them.
          </p>
          <NotationExample
            pattern={p(n('8'), n('8'), n('q'), n('8'), n('8'), n('q'), n('8'), n('8'), n('8'), n('8'), n('h'))}
            caption="Count: “1 & 2, 3 & 4, 1 & 2 &, 3‑(4).”"
          />
        </section>

        <section id="sixteenth-notes" className="learn-section">
          <h2>Sixteenth notes</h2>
          <p>
            A <strong>sixteenth note</strong> has two flags (or a double beam). It lasts a quarter
            of a beat, so four sixteenths fill one beat. They are counted{' '}
            <strong>“1‑e‑&amp;‑a, 2‑e‑&amp;‑a …”</strong> — four even syllables per beat.
          </p>
          <p>
            Sixteenths often mix with eighth notes inside a single beat. A common figure is one
            eighth followed by two sixteenths (“1&nbsp;&amp;‑a”), or two sixteenths followed by an
            eighth (“1‑e‑&amp;”). Keep the underlying beat steady and fit the subdivisions inside
            it.
          </p>
          <NotationExample
            pattern={p(
              n('16'), n('16'), n('16'), n('16'), n('q'),
              n('8'), n('16'), n('16'), n('q'),
              n('16'), n('16'), n('16'), n('16'), n('16'), n('16'), n('16'), n('16'), n('h'),
            )}
            caption="Beat 1: “1‑e‑&‑a”; beat 3: “3 &‑a”; then a full measure mixing sixteenths and a half note."
          />
        </section>

        <section id="beams" className="learn-section">
          <h2>Beams and note groups</h2>
          <p>
            When several eighth or sixteenth notes appear in a row, their flags are joined into{' '}
            <strong>beams</strong> — thick horizontal lines connecting the stems. Beams do not
            change how the notes sound; they group notes by beat so the rhythm is easier to read at
            a glance. A single beam means eighth notes; a double beam means sixteenths.
          </p>
          <NotationExample
            pattern={p(n('8'), n('8'), n('8'), n('8'), n('16'), n('16'), n('16'), n('16'), n('q'))}
            caption="Beamed eighth notes (one beam) and beamed sixteenth notes (two beams). Each beamed group lines up with one beat."
          />
        </section>

        <section id="rests" className="learn-section">
          <h2>Rests: rhythm you don&apos;t play</h2>
          <p>
            Silence is part of rhythm too. A <strong>rest</strong> tells you to play nothing for a
            specific length of time. Every note value has a matching rest: the whole rest hangs
            below a staff line, the half rest sits on a line, the quarter rest is the squiggly
            symbol, and the eighth rest looks like a small flag with a dot.
          </p>
          <p>
            The crucial skill: <em>do not tap during a rest</em>, but keep counting through it. In
            these exercises a tap during a rest counts against you, so feel the silent beats just
            as strongly as the played ones.
          </p>
          <NotationExample
            pattern={p(n('q'), r('q'), n('q'), n('q'), n('q'), r('q'), n('8'), n('8'), n('q'))}
            caption="Count “1, (2), 3, 4 — 1, (2), 3 &, 4,” staying silent on the rests."
          />
          <NotationExample
            pattern={p(r('8'), n('8'), r('8'), n('8'), n('q'), n('q'), n('w'))}
            caption="Eighth rests on the beats push the notes onto the “ands”: “(1) &, (2) &, 3, 4.”"
          />
        </section>

        <section id="dotted-notes" className="learn-section">
          <h2>Dotted notes</h2>
          <p>
            A small <strong>dot</strong> after a note head makes the note half again as long
            (multiply by 1.5). A dotted half note lasts 2 + 1 = 3 beats; a dotted quarter lasts
            1 + ½ = 1½ beats.
          </p>
          <p>
            The most common dotted figure is the <strong>dotted quarter followed by an eighth</strong>:
            together they fill exactly two beats, with the second note landing on the “and” of the
            second beat. Count it “1‑(&amp;‑2)‑&amp;”: tap on 1, wait through the “and” and beat 2,
            then tap on the “and” of 2.
          </p>
          <NotationExample
            pattern={p(n('q', 1), n('8'), n('q'), n('q'), n('h', 1), n('q'))}
            caption="A dotted quarter + eighth (“1 … & of 2”), two quarters, then a dotted half note (3 beats) and a quarter."
          />
        </section>

        <section id="ties" className="learn-section">
          <h2>Ties</h2>
          <p>
            A <strong>tie</strong> is a curved line joining two notes of the same pitch. The two
            notes are played as <em>one</em> longer note: tap at the start of the first note and
            hold through the second — do not tap again. Ties are how composers write durations that
            cross a bar line or that have no single-symbol equivalent.
          </p>
          <p>
            When you see a tie in an exercise, the second note never gets a tap. Count straight
            through it as if it were part of the first note.
          </p>
          <NotationExample
            pattern={p(n('q'), n('q'), n('h', 0, true), n('q'), n('q'), n('q'), n('q'))}
            caption="The half note is tied across the bar line into the next quarter: one tap on beat 3, held for three beats."
          />
        </section>

        <section id="syncopation" className="learn-section">
          <h2>Syncopation</h2>
          <p>
            <strong>Syncopation</strong> means putting emphasis where the listener doesn&apos;t
            expect it — on the “ands” between beats, or holding a note across a strong beat so the
            strong beat itself is silent. It is the engine of most popular music, jazz, and latin
            rhythms.
          </p>
          <p>
            Syncopated rhythms usually combine the tools you already know: eighth notes that start
            off the beat, ties that carry a note over a strong beat, and rests on the beat. Count
            subdivisions out loud (“1 &amp; 2 &amp; …”) and trust the count rather than your
            instinct to tap on the beat.
          </p>
          <NotationExample
            pattern={p(n('8'), n('q'), n('q'), n('q'), n('8', 0, true), n('q'), n('q'), n('q'), n('8'), n('8'))}
            caption="A push figure: the last eighth of the first measure ties over the bar line, so the downbeat of measure two is held, not tapped."
          />
          <NotationExample
            pattern={p(n('q', 1), n('8', 0, true), n('h'), n('q', 1), n('8'), r('q'), n('q'))}
            caption="The “Charleston” figure: dotted quarter plus an eighth that anticipates beat 3."
          />
        </section>

        <section id="simple-vs-compound" className="learn-section">
          <h2>Simple vs. compound meter</h2>
          <p>
            Everything above uses <strong>simple meter</strong>: each beat divides naturally into
            two halves (“1 &amp;”). In <strong>compound meter</strong> — time signatures like 6/8,
            9/8 and 12/8 — each beat divides into <em>three</em>. In 6/8 there are six eighth notes
            per measure, felt as two big beats of three eighths each: “<strong>1</strong>‑2‑3,{' '}
            <strong>4</strong>‑5‑6.”
          </p>
          <p>
            The exercises on this site stay in simple meters (4/4, 3/4 and 2/4), but you will meet
            compound meters everywhere in real music — jigs, lullabies, and ballads especially. The
            reading skills are the same: know what gets the beat, and subdivide.
          </p>
          <NotationExample
            timeSignature="3/4"
            pattern={p(n('q'), n('8'), n('8'), n('q'), n('h', 1))}
            caption="3/4 (simple meter): three quarter-note beats per measure, each splitting in two."
          />
        </section>

        <p className="learn-footer">
          Ready to put it into practice? Head back to your{' '}
          <a href="/dashboard">dashboard</a> and the trainer will pick the right exercise for you.
        </p>
      </article>
    </div>
  )
}
