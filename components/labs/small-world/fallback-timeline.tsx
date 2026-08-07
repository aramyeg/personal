import { ALWINA, CONTACT_HREF } from './alwina-cv'
import { SMALL_WORLD_PREMISE } from './alwina-story'
import { chapters } from './chapters'
import { FALLBACK_CLASS } from './fallback-class'
import { FALLBACK_STYLE } from './fallback-timeline-style'

/**
 * Server-rendered career timeline — the crawler / no-WebGL / reduced-motion
 * path. Carries the lab's pastel skin (FALLBACK_STYLE) so the pre-scene state
 * reads as Small World, not the site's dark theme; the client shell collapses it
 * once the 3D scene takes over.
 *
 * TASK 65 — IT HAS TO END WHERE THE SCENE DOES. Until now this page stopped at
 * the last job, because the lab's "say hi" lived in a panel the scene owned.
 * Task 65 moves the contact story into the ending's desk reveal, which a
 * reduced-motion or no-WebGL visitor never sees — the canvas is not merely
 * hidden for them, `SmallWorldExperience` returns null and never mounts it. So
 * the ONE route to Aram would have disappeared for exactly the visitors least
 * able to go looking for it. The block below is that route, in plain markup:
 * no JavaScript, and it ships in the initial HTML so a crawler reads it too.
 *
 * TASK 85 — IT IS HER ROUTE, NOT HIS. It printed Aram's email and his two
 * profiles until finding 1; see the note on the footer itself.
 */
export function FallbackTimeline() {
  return (
    <section data-testid="small-world-fallback" className={FALLBACK_CLASS} aria-label="Career journey">
      <style>{FALLBACK_STYLE}</style>
      {/* ONE OWNER (Task 85). This sentence lived here as a literal and nowhere
          else, so the only stated premise in the product reached only the
          visitors who had asked for less motion. The first sheet prints it too
          now, from the same constant. */}
      <h1>{SMALL_WORLD_PREMISE}</h1>
      {/* The same six chapters the scene tells, in plain markup. The manga pages
          carry no information this list does not, so a visitor who never sees a
          canvas loses the pictures and none of the story. */}
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <h2>{c.theme}</h2>
            <p>{c.caption}</p>
            <p>{c.hook}</p>
            <ul>
              {c.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{c.stamps.join(' · ')}</p>
            <p>{c.tech.join(', ')}</p>
          </li>
        ))}
      </ol>
      {/* ============================================================================
          WHOSE ADDRESSES THESE ARE (Task 85, finding 1)
          ============================================================================
          They were ARAM'S — `siteConfig.email` plus his GitHub and LinkedIn — on
          a page telling Alwina's story, which is the same defect the ending's
          pills carried and reached the crawler and the screen-reader visitor
          besides. This is HER one known address now, from the same owner
          (`alwina-cv.ts`) the ending pill and the plain CV read.

          NO EMAIL, and that is the standing rule rather than an omission: her
          real address is not known to this repo, and a plausible-looking
          invented one on a real person's CV is the worst available failure.

          THE LAB NO LONGER IMPORTS IDENTITY FROM `lib/constants`. That file is
          the main portfolio's and stays Aram's; the fix is that this page stops
          reaching into it, not that anything there changes. */}
      <footer>
        <h2>Come say hi</h2>
        <p>That&apos;s my whole world so far — I&apos;d love to hear from you.</p>
        <ul>
          <li>
            <a href={CONTACT_HREF} target="_blank" rel="noopener noreferrer">
              {ALWINA.contact}
            </a>
          </li>
        </ul>
      </footer>
    </section>
  )
}
