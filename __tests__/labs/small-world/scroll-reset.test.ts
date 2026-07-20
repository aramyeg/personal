import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginManualScrollRestoration, pinScrollToTop } from '@/components/labs/small-world/scroll-reset'

describe('beginManualScrollRestoration', () => {
  beforeEach(() => {
    history.scrollRestoration = 'auto'
  })
  afterEach(() => {
    history.scrollRestoration = 'auto'
  })

  it('switches the browser to manual restoration so the browser stops re-applying deep scroll', () => {
    beginManualScrollRestoration()
    expect(history.scrollRestoration).toBe('manual')
  })

  it('restores the previous mode on cleanup (keeps other routes normal)', () => {
    history.scrollRestoration = 'auto'
    const restore = beginManualScrollRestoration()
    expect(history.scrollRestoration).toBe('manual')
    restore()
    expect(history.scrollRestoration).toBe('auto')
  })
})

describe('pinScrollToTop', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('scrolls the window to the very top (progress 0)', () => {
    pinScrollToTop()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('bypasses smooth scroll-behavior and restores it (no visible snap-back)', () => {
    const html = document.documentElement
    html.style.scrollBehavior = 'smooth'
    ;(window.scrollTo as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      // During the scroll, smooth must be off so the jump is instant.
      expect(html.style.scrollBehavior).toBe('auto')
    })
    pinScrollToTop()
    // …and put back afterwards so the rest of the page keeps smooth scrolling.
    expect(html.style.scrollBehavior).toBe('smooth')
  })
})
