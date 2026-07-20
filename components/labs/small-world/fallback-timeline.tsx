import { chapters } from './chapters'
import { FALLBACK_CLASS } from './fallback-class'
import { FALLBACK_STYLE } from './fallback-timeline-style'

/**
 * Server-rendered career timeline — the crawler / no-WebGL / reduced-motion
 * path. Carries the lab's pastel skin (FALLBACK_STYLE) so the pre-scene state
 * reads as Small World, not the site's dark theme; the client shell collapses it
 * once the 3D scene takes over.
 */
export function FallbackTimeline() {
  return (
    <section data-testid="small-world-fallback" className={FALLBACK_CLASS} aria-label="Career journey">
      <style>{FALLBACK_STYLE}</style>
      <h1>Small World — a career in one lap of a tiny planet</h1>
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <h2>
              {c.role} — {c.company}
            </h2>
            <p>
              {c.period} · {c.location}
            </p>
            <p>{c.description}</p>
            <ul>
              {c.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p>{c.technologies.join(', ')}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
