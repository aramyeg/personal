import { skills } from '@/data'
import { siteConfig, socialLinks } from '@/lib/constants'
import { BOOK_SUBTITLE, BOOK_TITLE, CHAPTERS, experienceFor } from './content'
import { SATCHEL_ITEMS, satchelSkill } from './satchel-items'

/**
 * Pure, server-renderable tale content — every real fact, no motion, no canvas.
 * Shared by the styled reading view (`PlainTale`) and the sr-only crawlable
 * shadow (`CrawlableTale`).
 */
export function TaleArticle() {
  return (
    <article className="space-y-16">
      <header className="space-y-3 border-b border-[var(--sb-gold)]/30 pb-10">
        <p className="sb-chapter-kicker">A chronicle</p>
        <h1 className="sb-chapter-title">{BOOK_TITLE}</h1>
        <p className="sb-narration">{BOOK_SUBTITLE}</p>
      </header>

      {CHAPTERS.map((chapter) => {
        const exp = experienceFor(chapter)
        return (
          <section
            key={chapter.experienceId}
            aria-labelledby={`chapter-${chapter.experienceId}`}
            className="space-y-4 border-b border-[var(--sb-gold)]/20 pb-10 last:border-b-0 last:pb-0"
          >
            <p className="sb-chapter-kicker">{chapter.kicker}</p>
            <h2 id={`chapter-${chapter.experienceId}`} className="sb-chapter-title">
              {chapter.numeral}. {chapter.title}
            </h2>
            <p className="sb-narration">{chapter.narration}</p>
            <p className="sb-plaque">
              <strong>{exp.company}</strong> · {exp.role} · {exp.location} · {exp.period}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-[var(--sb-gold-deep)]">
              {exp.highlights.slice(0, 3).map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </section>
        )
      })}

      <section aria-labelledby="satchel-heading" className="space-y-6">
        <div className="space-y-3">
          <p className="sb-chapter-kicker">The hero&rsquo;s satchel</p>
          <h2 id="satchel-heading" className="sb-chapter-title">
            What He Carries
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SATCHEL_ITEMS.map((item) => {
            const skill = satchelSkill(item)
            return (
              <li key={item.assetId} className="sb-plaque space-y-1.5 text-left">
                <h3 className="font-semibold not-italic">{item.itemName}</h3>
                <p>
                  {skill.name} — {skill.years} years · {skill.level}
                </p>
                <p className="opacity-90">{item.blurb}</p>
              </li>
            )
          })}
        </ul>
        <p className="sb-chapter-kicker leading-relaxed">
          Also carried, in lighter pouches: {skills.map((s) => s.name).join(', ')}
        </p>
      </section>

      <section aria-labelledby="the-end-heading" className="space-y-5 border-t border-[var(--sb-gold)]/30 pt-10">
        <h2 id="the-end-heading" className="sb-chapter-title">
          The End (For Now)
        </h2>
        <p className="sb-narration">
          Should your kingdom have need of the hero — a kingdom to raise, a dragon to gentle —
          send a raven.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${siteConfig.email}`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--sb-gold)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--sb-gold)]/15"
          >
            Send a raven
          </a>
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--sb-gold)]/50 px-4 py-2 text-sm transition-colors hover:bg-[var(--sb-gold)]/15"
            >
              {link.name}
            </a>
          ))}
        </div>
      </section>
    </article>
  )
}

/** Styled full-page reading view: same paper/font tokens as the book, long-form scroll. */
export function PlainTale() {
  return (
    <div className="sb-root min-h-screen">
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="rounded-sm bg-[var(--sb-paper)] px-6 py-12 text-[var(--sb-ink)] shadow-2xl ring-1 ring-[var(--sb-gold)]/40 sm:px-12 sm:py-16">
          <TaleArticle />
        </div>
      </main>
    </div>
  )
}
