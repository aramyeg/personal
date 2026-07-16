import { chapters } from './chapters'

/**
 * Server-rendered career timeline — the crawler / no-WebGL / reduced-motion
 * path. Hidden by the client shell once the 3D scene takes over.
 */
export function FallbackTimeline() {
  return (
    <section data-testid="small-world-fallback" aria-label="Career journey">
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
