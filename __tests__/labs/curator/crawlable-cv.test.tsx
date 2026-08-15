import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CuratorCrawlableCv } from '@/components/labs/curator/crawlable-cv'
import { experiences } from '@/data/experience'
import { briefs } from '@/components/labs/curator/annotations'

describe('CuratorCrawlableCv', () => {
  it('server-renders the full cv and engineering notes', () => {
    const html = renderToStaticMarkup(<CuratorCrawlableCv />)
    expect(html).toContain('Aram Yeghiazaryan')
    for (const e of experiences) expect(html).toContain(e.company)
    for (const b of briefs) expect(html).toContain(b.title)
  })
})
