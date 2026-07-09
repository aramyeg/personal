'use client'

import { useEffect, useState } from 'react'
import { TaleArticle } from './plain-tale'

/** Server-rendered for crawlers; removes itself once the book hydrates. */
export function CrawlableTale() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  if (hydrated) return null
  return (
    <section aria-label="the tale, in full" className="sr-only">
      <TaleArticle />
    </section>
  )
}
