/**
 * TASK 83 — THE ESCAPE HATCH: one plain, dense, readable view of her CV.
 *
 * Task 77's non-negotiable N1, and the reason it is a whole task: across ~25
 * story-shaped portfolios the plain view is not missing, it is HIDDEN — linked
 * nowhere, or behind an unlabelled printer icon. So the gates below are in three
 * groups, and they are three different kinds of promise:
 *
 *  1. ONE OWNER OF FACTS. Three surfaces print her roles and dates. If they can
 *     disagree, one of them will, about a real person's career.
 *  2. THE CONTENT IS THE APPROVED PACK, and nothing has been helpfully added —
 *     most of all not an email, which does not exist in this repo.
 *  3. THE SURFACE STOPS THE MEDIUM AND GIVES IT BACK. Escape closes it, the world
 *     does not move, and focus returns to the door it came through.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  ALWINA,
  CONTACT_HREF,
  CREDITS,
  DEGREE,
  LANGUAGES,
  ROLES_NEWEST_FIRST,
  STACK,
  captionFor,
  creditLine,
  footerFor,
  periodLong,
  periodShort,
} from '@/components/labs/small-world/alwina-cv'
import { ALWINA_STORY } from '@/components/labs/small-world/alwina-story'
import { INFO_PAGES } from '@/components/labs/small-world/overlay/info-page-spec'
import { InfoPage } from '@/components/labs/small-world/overlay/info-page'
import { CvDocument, CV_TYPE_FLOOR_PX } from '@/components/labs/small-world/overlay/cv-document'
import { CvOverlay, SCROLL_EPSILON_PX, scrollRestoreTarget } from '@/components/labs/small-world/overlay/cv-overlay'
import {
  CV_CLOSE_TESTID,
  CV_DOC_TESTID,
  CV_LABEL,
  CV_SHEET_LINK_TESTID,
  CV_TESTID,
  cvArmed,
  openCv,
  setCvOpener,
} from '@/components/labs/small-world/overlay/cv-open'
import { MIN_TEXT_PX } from '@/components/labs/small-world/manga/lettering'

afterEach(cleanup)

/** The rendered document's text, with layout whitespace normalised away. */
const docText = () => screen.getByTestId(CV_DOC_TESTID).textContent!.replace(/\s+/g, ' ').trim()

describe('one owner of her credits', () => {
  it('renders the wall labels the approved pack writes, from the data rather than from a literal', () => {
    // THE PIN. Every one of these is `.superpowers/sdd/task-80-report.md` ROUND 3,
    // and the point of asserting them here rather than trusting `captionFor` is that
    // the derivation must reproduce the pack EXACTLY — including that the wall label
    // abbreviates the second year and the colophon does not.
    expect(ALWINA_STORY.map((c) => c.caption)).toEqual([
      'Master of Marketing & Business — Université Jean Moulin Lyon III, 2013–19',
      'Frontend Developer — IU Networks, 2020–21',
      'UI/UX Engineer — Sportion, 2021',
      'React Developer — qiibee, 2021–23',
      'Full-stack Software Engineer — Wooskill, 2023–24',
      'Frontend Engineer — Sync Design Tech, 2025–now',
    ])
  })

  it('renders the colophons the same way, in the other house style', () => {
    expect(INFO_PAGES.map((p) => p.footer.period)).toEqual([
      '2013–2019',
      '2020–2021',
      '2021',
      '2021–2023',
      '2023–2024',
      '2025–now',
    ])
  })

  it('lets the two surfaces disagree about NOTHING but how a year is abbreviated', () => {
    // The drift that was already there before this file existed, stated as a law: the
    // walk's label and the leaf's colophon are two renderings, not two sources.
    CREDITS.forEach((c, i) => {
      expect(ALWINA_STORY[i].caption).toBe(captionFor(i))
      expect(INFO_PAGES[i].footer).toEqual(footerFor(i))
      expect(ALWINA_STORY[i].caption).toContain(c.org)
      expect(INFO_PAGES[i].footer.org).toBe(c.org)
      expect(INFO_PAGES[i].footer.role).toBe(c.title)
    })
  })

  it('prints a one-year credit once rather than as a range', () => {
    const sportion = CREDITS.find((c) => c.org === 'Sportion')!
    expect(periodLong(sportion)).toBe('2021')
    expect(periodShort(sportion)).toBe('2021')
  })

  it('gives the sheet and the CV page the same identity block, by identity', () => {
    // Not "the same strings" — the same OBJECT. The first sheet's intro is `ALWINA`,
    // so her name cannot be corrected in one place and left stale in the other.
    expect(INFO_PAGES[0].ketsu.intro).toBe(ALWINA)
  })

  it('reverses the walk for the CV without retyping a job', () => {
    expect(ROLES_NEWEST_FIRST.map((c) => c.org)).toEqual([
      'Sync Design Tech',
      'Wooskill',
      'qiibee',
      'Sportion',
      'IU Networks',
    ])
    expect(DEGREE.org).toBe('Université Jean Moulin Lyon III')
  })
})

describe('the plain CV page', () => {
  /**
   * TASK 103 — THE NICKNAME STOPS AT THE CV'S DOOR.
   *
   * Aram asked for "Alwina" to read "Alwi" wherever the lab shows it. The plain CV
   * is the one surface that does not follow, and this is the gate that says so out
   * loud rather than leaving it to whoever edits `alwina-cv.ts` next: a document a
   * recruiter prints, saves or searches for has to carry the legal name. (The
   * route's `<title>` is the other exception, gated in `ending-connect.test.tsx`.)
   */
  it('carries her LEGAL name, not the name the world calls her', () => {
    render(<CvDocument />)
    const text = docText()
    expect(ALWINA.name).toBe('Alwina Harutyunyan')
    expect(ALWINA.display).not.toBe(ALWINA.name)
    expect(text).toContain(ALWINA.name)
    expect(text).not.toContain(ALWINA.display)
  })

  it('prints the approved sheet block, in full and in order', () => {
    render(<CvDocument />)
    const text = docText()
    const expected = [
      ALWINA.name,
      ALWINA.says,
      'Frontend Engineer — Sync Design Tech · 2025–now',
      'Full-stack Software Engineer — Wooskill · 2023–2024',
      'React Developer — qiibee · 2021–2023',
      'UI/UX Engineer — Sportion · 2021',
      'Frontend Developer — IU Networks · 2020–2021',
      'Master of Marketing & Business — Université Jean Moulin Lyon III · 2013–2019',
      'Languages — English, Russian, French, Armenian',
      'Stack — React, PHP, AWS, component libraries, real-time dashboards, infrastructure as code',
      ALWINA.contact,
    ]
    let cursor = 0
    for (const line of expected) {
      const at = text.indexOf(line, cursor)
      expect(at, `"${line}" missing or out of order`).toBeGreaterThanOrEqual(0)
      cursor = at
    }
  })

  it('keeps each credit as ONE line of text, so a copy-paste is the pack’s own line', () => {
    // Task 82 shipped "thentaught" by splitting a sentence into block elements — what a
    // copy-paste, a page search and a screen reader receive is `textContent`, and no
    // capture would ever have shown it. Every separator here is a real text node.
    render(<CvDocument />)
    const lines = [...ROLES_NEWEST_FIRST, DEGREE].map(creditLine)
    // Read the credit's OWN inline flow, not its `li`: Task 85 nests each role's
    // claims inside that list item so a page break cannot land between a job and
    // what she did there, and an `li` query would then be checking the credit plus
    // three sentences against a one-line expectation and passing for the wrong
    // reason — or failing for one.
    const items = [...screen.getByTestId(CV_DOC_TESTID).querySelectorAll('[data-sw-credit]')].map(
      (el) => el.textContent!.replace(/\s+/g, ' ').trim()
    )
    expect(items).toHaveLength(lines.length)
    for (const line of lines) expect(items).toContain(line)
  })

  it('names the languages without counting them', () => {
    // Story law 5: stated as fact, never counted and never offered as an asset.
    render(<CvDocument />)
    const text = docText()
    for (const l of LANGUAGES) expect(text).toContain(l)
    expect(text).not.toMatch(/\b(four|4)\s+languages\b/i)
    expect(text).not.toMatch(/fluent|native|bilingual/i)
  })

  it('carries the whole stack row', () => {
    render(<CvDocument />)
    for (const s of STACK) expect(docText()).toContain(s)
  })

  it('links the contact it prints, and INVENTS NO EMAIL', () => {
    // The worst available failure on this page is a plausible-looking address that is
    // not hers. The gate is on the shape rather than on anyone remembering.
    render(<CvDocument />)
    const link = screen.getByRole('link', { name: ALWINA.contact })
    expect(link).toHaveAttribute('href', CONTACT_HREF)
    expect(CONTACT_HREF).toBe(`https://${ALWINA.contact}`)
    expect(docText()).not.toContain('@')
    expect(screen.getByTestId(CV_DOC_TESTID).innerHTML).not.toContain('mailto')
  })

  it('never describes her from outside', () => {
    // The same law the story is held to, applied to the surface a recruiter reads.
    render(<CvDocument />)
    expect(/\b(she|her|hers|herself)\b/i.test(docText())).toBe(false)
  })

  it('sets nothing below the lab’s own lettering floor', () => {
    // Every size on the page is a clamp() whose MINIMUM is one of these, so the phone
    // lands on the floor by construction rather than by a screenshot someone looked at.
    for (const [name, px] of Object.entries(CV_TYPE_FLOOR_PX)) {
      expect(px, `${name} floor`).toBeGreaterThanOrEqual(MIN_TEXT_PX)
    }
    // ...and the body register keeps real headroom over it rather than sitting on it.
    expect(CV_TYPE_FLOOR_PX.meta).toBeGreaterThan(MIN_TEXT_PX + 2)
  })
})

describe('the surface stops the medium, and gives it back', () => {
  it('closes on Escape, and claims the key so the lab is not left with it', () => {
    // The lab's Escape protocol: `gallery-chrome.tsx` navigates to the museum on a
    // bubbled Escape unless it was already handled. Without the preventDefault, closing
    // the CV would also close the lab.
    const onClose = vi.fn()
    render(<CvOverlay onClose={onClose} />)
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    window.dispatchEvent(e)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('closes on the scrim and NOT on the page', () => {
    const onClose = vi.fn()
    render(<CvOverlay onClose={onClose} />)
    fireEvent.click(screen.getByTestId(CV_DOC_TESTID))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(CV_TESTID))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a word rather than on a glyph', () => {
    const onClose = vi.fn()
    render(<CvOverlay onClose={onClose} />)
    const close = screen.getByTestId(CV_CLOSE_TESTID)
    expect(close.textContent).toMatch(/close/i)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is a labelled modal dialog, named by the heading rather than by a second string', () => {
    render(<CvOverlay onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(ALWINA.name)
  })

  it('returns focus to the door it came through, WITHOUT scrolling to it', () => {
    // THE DEFECT THIS PINS, found by e2e and invisible to every capture: `focus()`
    // scrolls the element's ancestors to reveal it, so handing focus back to the
    // sheet's link dragged the track 222px out from under the reader. `preventScroll`
    // is the fix, and asserting the OPTION rather than the resulting scroll is what
    // makes it testable in jsdom, which has no layout to scroll.
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const spy = vi.spyOn(opener, 'focus')
    const { unmount } = render(<CvOverlay onClose={() => {}} />)
    expect(document.activeElement).not.toBe(opener)
    unmount()
    expect(document.activeElement).toBe(opener)
    expect(spy).toHaveBeenCalledWith({ preventScroll: true })
    spy.mockRestore()
    opener.remove()
  })

  it('leaves the world exactly where it was', () => {
    // SCROLL PURITY. The lightbox never unmounts the journey, so this is true by
    // construction — and the assertion is that nothing SCROLLS on the way out either,
    // because a "restore" that fires on every close is a scroll the reader would see.
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { unmount } = render(<CvOverlay onClose={() => {}} />)
    unmount()
    expect(scrollTo).not.toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  it('restores the scroll only when something actually moved it', () => {
    expect(scrollRestoreTarget(1200, 1200)).toBeNull()
    expect(scrollRestoreTarget(1200, 1200 + SCROLL_EPSILON_PX / 2)).toBeNull()
    expect(scrollRestoreTarget(1200, 1900)).toBe(1200)
    expect(scrollRestoreTarget(1200, 300)).toBe(1200)
  })

  it('prints the CV and not the sixteen-viewport scroll track it lives in', () => {
    // A recruiter hitting Ctrl+P is this page's real use. Hiding by `visibility` would
    // leave the track's boxes occupying layout — dozens of blank sheets around one page.
    const { container } = render(<CvOverlay onClose={() => {}} />)
    const css = container.querySelector('style')?.textContent ?? document.querySelector('[data-sw-cv-root] style')!.textContent!
    expect(css).toContain('@media print')
    expect(css).toContain('body > *:not([data-sw-cv-root])')
    expect(css).toContain('display: none !important')
    expect(css).toContain('@page')
    // the close button is chrome and must not print
    expect(css).toContain('[data-sw-cv-chrome]')
  })
})

describe('the two doors', () => {
  it('prints the first one on the sheet that carries her name, and only there', () => {
    render(<InfoPage chapter={0} page={1} />)
    expect(screen.getByTestId(CV_SHEET_LINK_TESTID)).toBeInTheDocument()
    cleanup()
    for (const i of [1, 2, 3, 4, 5]) {
      render(<InfoPage chapter={i} page={1} />)
      expect(screen.queryByTestId(CV_SHEET_LINK_TESTID), `chapter ${i + 1}`).toBeNull()
      cleanup()
    }
  })

  it('rides the contact row, and reads as one line when copied', () => {
    render(<InfoPage chapter={0} page={1} />)
    const sheet = screen.getByTestId('sw-cloth-line').textContent!.replace(/\s+/g, ' ').trim()
    expect(sheet).toContain(`${ALWINA.contact} · ${CV_LABEL}`)
  })

  it('says a word rather than showing an icon', () => {
    render(<InfoPage chapter={0} page={1} />)
    expect(screen.getByTestId(CV_SHEET_LINK_TESTID).textContent).toBe(CV_LABEL)
  })

  it('opens through the seam, and is a no-op when no surface is listening', () => {
    expect(cvArmed()).toBe(false)
    expect(() => openCv()).not.toThrow()

    const open = vi.fn()
    const retract = setCvOpener(open)
    expect(cvArmed()).toBe(true)
    render(<InfoPage chapter={0} page={1} />)
    fireEvent.click(screen.getByTestId(CV_SHEET_LINK_TESTID))
    expect(open).toHaveBeenCalledTimes(1)
    retract()
    expect(cvArmed()).toBe(false)
  })

  it('retracts on IDENTITY, so a replacement mounted before a cleanup survives it', () => {
    const first = vi.fn()
    const second = vi.fn()
    const retractFirst = setCvOpener(first)
    setCvOpener(second)
    retractFirst()
    openCv()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    setCvOpener(null)
  })
})
