'use client'

import { useEffect, useState } from 'react'
import { SkillsSummary } from './skills-summary'

/**
 * Server-rendered by default so crawlers/ATS see the full skill list without
 * JS. Once the client game mounts, this fallback would duplicate the same
 * heading/text the interactive sheet and recap already expose accessibly —
 * so it removes itself the instant JS is confirmed to be running.
 */
export function CrawlableSkills() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  if (hydrated) return null
  return (
    <section aria-label="skills summary" className="sr-only">
      <SkillsSummary />
    </section>
  )
}
