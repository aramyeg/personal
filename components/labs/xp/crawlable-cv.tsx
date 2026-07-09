'use client'

import { useEffect, useState } from 'react'
import { experiences, projects, skills } from '@/data'
import { siteConfig, socialLinks } from '@/lib/constants'

export function CvArticle() {
  return (
    <article>
      <h1>{siteConfig.name} — {siteConfig.title}</h1>
      <p>{siteConfig.description}</p>
      <h2>Experience</h2>
      <ul>
        {experiences.map((e) => (
          <li key={e.id}>
            <strong>{e.role}</strong> at {e.company}, {e.period}. {e.description}
          </li>
        ))}
      </ul>
      <h2>Projects</h2>
      <ul>
        {projects.map((p) => (
          <li key={p.id}><strong>{p.title}</strong> — {p.description}</li>
        ))}
      </ul>
      <h2>Skills</h2>
      <p>{skills.map((s) => s.name).join(', ')}</p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        {socialLinks.map((l) => (
          <a key={l.name} href={l.url}> {l.name}</a>
        ))}
      </p>
    </article>
  )
}

/** Server-rendered for crawlers/ATS; removes itself once the desktop hydrates. */
export function CrawlableCv() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  if (hydrated) return null
  return (
    <section aria-label="curriculum vitae" className="sr-only">
      <CvArticle />
    </section>
  )
}
