import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CvArticle } from '@/components/labs/xp/crawlable-cv'

describe('CrawlableCv', () => {
  it('server-renders role, experience, projects, skills and contact', () => {
    const html = renderToStaticMarkup(<CvArticle />)
    expect(html).toContain('Senior Frontend Engineer')
    expect(html).toContain('mailto:aramyeg96@gmail.com')
    expect(html).toContain('TypeScript')
  })
})
