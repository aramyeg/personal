import { siteConfig, socialLinks } from '@/lib/constants'
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
 * same address, same two profiles, no JavaScript, and it ships in the initial
 * HTML so a crawler reads it too.
 */
export function FallbackTimeline() {
  return (
    <section data-testid="small-world-fallback" className={FALLBACK_CLASS} aria-label="Career journey">
      <style>{FALLBACK_STYLE}</style>
      <h1>Small World — a career in one lap of a tiny planet</h1>
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
      <footer>
        <h2>Connect with me</h2>
        <p>The next chapter is unwritten — say hi.</p>
        <ul>
          <li>
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </li>
          {socialLinks.map((l) => (
            <li key={l.name}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.name}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </section>
  )
}
