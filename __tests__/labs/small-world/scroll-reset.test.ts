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

  const lastCall = () =>
    (window.scrollTo as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1) as unknown[]

  it('scrolls the window to the very top (progress 0)', () => {
    pinScrollToTop()
    const [first, second] = lastCall()
    if (typeof first === 'object' && first !== null) {
      expect(first).toMatchObject({ top: 0, left: 0 })
    } else {
      expect([first, second]).toEqual([0, 0])
    }
  })

  /**
   * TASK 106 — this used to assert only that the inline style was `auto` while the call ran, and
   * that assertion passed for three rounds against a body that did not actually bypass anything:
   * Chrome reads the CACHED computed `scroll-behavior` inside `scrollTo`, so setting the property
   * and scrolling in one synchronous block leaves the stylesheet's `smooth` in charge (measured:
   * a 14 220 px "instant" pin animating over 90 frames). jsdom cannot see that, so the law here is
   * BOTH overrides being asked for rather than either one being asked for.
   */
  it('asks for the jump instantly by both available routes, and restores the page after', () => {
    const html = document.documentElement
    html.style.scrollBehavior = 'smooth'
    ;(window.scrollTo as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      expect(html.style.scrollBehavior).toBe('auto')
    })
    pinScrollToTop()
    expect(lastCall()[0]).toMatchObject({ behavior: 'instant' })
    // …and smooth scrolling is put back, so the rest of the page is untouched.
    expect(html.style.scrollBehavior).toBe('smooth')
  })
})
