'use client'
import type { CSSProperties, ReactNode } from 'react'
import { PALETTE } from '../palette'
import { CvSheetLink } from './cv-sheet-link'
import type { InfoPageSpec } from './info-page-spec'
import { SMALL_WORLD_PREMISE } from '../alwina-story'
import { EMAIL_HREF } from '../alwina-cv'

/**
 * THE SHEET — a slip of paper lying on the leaf, with the words printed on it.
 *
 * ============================================================================
 * V4: THE RUNNER IS GONE, AND WHAT IS LEFT IS WHAT V1–V3 KEPT AGREEING ON
 * ============================================================================
 * V1 clipped the words to the region a running chibi had swept, so until she had
 * run the sentence did not exist; the blind audit named that as a fact gated on
 * watching and it was right. V2 printed the sentence from frame 1 and demoted the
 * cloth to a translucent veil passing over it — the fact was safe and the gag was
 * gone. V3 put the words back on an opaque sheet, which was honest once Task 82
 * made the page's clock pure scroll.
 *
 * Aram's verdict on the shipped V3 (Task 105) is that the run itself does not
 * belong on these cards. So the RUNNER, the trailing wave, the curled leading
 * edge and the per-line hinge are all deleted, and the path that survives is the
 * one every previous version already described as correct: V3's own reduced-motion
 * branch. "p = 1, no runner, no wave: the sheet is simply open and the words are
 * simply printed." That was two lines in a component; it is now the whole
 * component.
 *
 * THIS IS A CV FOR RECRUITERS. Calm and readable beats clever, and a sheet that
 * is already open the moment the card arrives is the calmest form of the thing
 * the three previous versions were all reaching for.
 *
 * ============================================================================
 * THE BLIND AUDIT'S LAW, NOW BY CONSTRUCTION
 * ============================================================================
 * The law is that information is present instantly and animation only ever
 * embellishes — never gate a fact on watching. V3 kept it with three separate
 * guarantees (text in the DOM from frame 1; a soft mask that dims and never
 * removes; an unfurl that closes before the reader lands). With nothing to
 * unfurl there is nothing left to guarantee: this component has no clock, no
 * progress input and no reveal of any kind, so there is no state of it in which
 * a word is missing. NOTHING HERE MAY EVER TAKE A `t` AGAIN — a reveal on this
 * surface is the defect the audit was opened for.
 *
 * WHY THE SHEET STAYS. It is not scaffolding for the run: it is what makes the
 * page's last block read as a slip of paper laid on a comic page rather than as a
 * fourth panel. Captured without the outline and shadow, the block reads as loose
 * type floating under the hero; with them it reads as a printed colophon slip,
 * which is what it is. (The file keeps its name and its test ids: `sw-cloth-line`
 * is what the unit suites reach for, and renaming it would be churn in two files
 * to say the same thing — the same argument `sw-panel-data` already carries.)
 */

/**
 * Break a sentence into whole-word runs, one line per ~6 words, between two and
 * `max`.
 *
 * IT OUTLIVED THE CURL IT WAS BUILT FOR. The split existed so each run could
 * carry its own hinge out of the page; with the hinge gone it is still what keeps
 * the sheet's measure short — fewer than two lines and the sentence sets as a
 * banner, more than four and the sheet becomes a paragraph, which is the one
 * thing the page's text guard exists to prevent.
 *
 * Balanced by CHARACTERS rather than by word count — four short words and four
 * long ones are not two equal lines — and the `remaining` check is what stops a
 * greedy split leaving the last line with one word on it.
 */
export function sheetLines(text: string, max = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return words.length ? [words.join(' ')] : []
  const n = Math.max(2, Math.min(max, Math.ceil(words.length / 6)))
  const target = words.join(' ').length / n
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    const wordsLeft = words.length - i - 1
    const linesLeft = n - out.length - 1
    if (out.length < n - 1 && next.length >= target && wordsLeft >= linesLeft && linesLeft > 0) {
      out.push(next)
      cur = ''
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Where the sheet's long edges sit in the 0–20 path space, and therefore how much
 * air the words must keep from them.
 *
 * IT IS SHARED WITH THE TEXT'S PADDING ON PURPOSE. An early version drew the
 * edges at 1.4/18.6 (7% and 93% of the band) while the text wrapper padded by
 * about 4%, and captured on chapter 1 the contact line ran straight through the
 * paper's own outline. One number, converted once, so the two cannot drift.
 */
const EDGE_Y = 1.0
/** The same inset as a percentage of the band, for the text that sits on it. */
const TEXT_INSET_PCT = (EDGE_Y / 20) * 100 + 3

/**
 * The sheet and the words printed on it.
 *
 * No `t`, no `reduced`: there is one path and it is the finished one. See the
 * header — a progress input on this component is the defect, not a feature.
 */
export function ClothDrag({
  line,
  intro,
}: {
  line: string
  /** Present on the FIRST sheet only — see `info-page-spec.ts`. */
  intro?: InfoPageSpec['ketsu']['intro']
}) {
  // NO ROLE-AND-YEARS ROW HERE. It came over from the retired title card, it is
  // not in the approved sheet copy, and it said a third time what the identity
  // line above it and the colophon below it already say. The colophon under the
  // sheet is where that fact lives (`info-page.tsx`).
  // THE ESCAPE HATCH RIDES THE CONTACT ROW (Task 83) rather than taking one of
  // its own: the first sheet is the tallest and every row here is a row off
  // chapter 1's hero panel. `after` is a node so the middot stays a REAL TEXT
  // NODE inside the row's own inline flow — see the separator note below, which
  // is the same defect twice.
  const rows: {
    key: string
    text: string
    kind: keyof typeof ROW_STYLE
    before?: ReactNode
    after?: ReactNode
  }[] = [
    ...(intro
      ? [
          // THE PREMISE, ABOVE HER NAME, ON THE FIRST SHEET ONLY (Task 85).
          //
          // "Small World — a career in one lap of a tiny planet" was a literal in
          // the reduced-motion fallback's `<h1>` and nowhere else, so the best
          // sentence in the product was served only to visitors who asked for
          // less motion. The blind audit's one STORY ding was that the premise
          // has no opening line, so chapter 1 does the work a title should.
          //
          // IT IS AN EYEBROW, which is the cheapest row this sheet can carry and
          // also the right shape: a title page states what the document is above
          // whose it is.
          { key: 'premise', text: SMALL_WORLD_PREMISE, kind: 'premise' as const },
          // `display`, not `name`: inside the world she is Alwi. The legal name is
          // the plain CV's and the tab's — see `alwina-cv.ts`.
          { key: 'name', text: intro.display, kind: 'name' as const },
          { key: 'says', text: intro.says, kind: 'says' as const },
        ]
      : []),
    ...sheetLines(line).map((text, i) => ({ key: `l${i}`, text, kind: 'line' as const })),
    ...(intro
      ? [
          {
            key: 'contact',
            // THE ROW PRINTS THE EMAIL, NOT THE LINKEDIN URL, and that is a
            // measured swap rather than a preference. Adding the address BESIDE
            // the profile was the first cut and the 390 capture convicted it: the
            // row wrapped to two lines, and because the sheet is `flex: 0 0 auto`
            // the second line came straight off chapter 1's hero panel — AND IT
            // STUCK was cut in half by the panel's own edge. That is the budget
            // this file has already been burned by twice, so the row is not
            // allowed to grow; it is allowed to change what it spends its one
            // line on. The address is 28 characters against the profile's 36, so
            // the swapped row is SHORTER than the one that shipped.
            // NOTHING IS LOST: LinkedIn is on the plain CV this row links to and
            // on the ending's own pill, and the contact a recruiter reaches for
            // first is the one you can write to.
            text: '',
            kind: 'contact' as const,
            // HER EMAIL (Task 105). For five rounds this sheet could offer a
            // reader no way to WRITE to her, because the repo did not have the
            // address and inventing one on a real person's CV is the worst
            // available failure. Aram supplied it verbatim.
            before: (
              <a href={EMAIL_HREF} style={CONTACT_LINK}>
                {intro.email}
              </a>
            ),
            after: (
              <>
                {' · '}
                <CvSheetLink />
              </>
            ),
          },
        ]
      : []),
  ]

  return (
    <div
      data-testid="sw-cloth-drag"
      style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}
    >
      {/* THE SHEET. Opaque paper, at its full width, with the words printed ON
          it. Drawn in a 100 x 20 space and stretched with
          `preserveAspectRatio: none` so one outline serves every leaf size. */}
      <svg
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* A SHADOW, because the sheet is a rectangle of paper on paper. Captured
            without one, it read as a bordered text box inside a bordered panel —
            two boxes, no sheet. An offset copy is what says "this is lying ON the
            page" in one shape and no filter. */}
        <rect
          x={0.35}
          y={EDGE_Y + 0.55}
          width={100}
          height={20 - 2 * EDGE_Y}
          fill={PALETTE.ink}
          opacity={0.17}
        />
        <rect
          x={0}
          y={EDGE_Y}
          width={100}
          height={20 - 2 * EDGE_Y}
          fill={PALETTE.pagePaper}
          stroke={PALETTE.ink}
          strokeWidth={0.6}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* THE WORDS. Real DOM text, complete, sitting on the paper. */}
      <div
        data-sw-text="info-line"
        data-testid="sw-cloth-line"
        style={{
          position: 'relative',
          width: '100%',
          padding: `${TEXT_INSET_PCT}% 2.2cqw`,
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        {rows.map((row, i) => (
          <div key={row.key} style={ROW_STYLE[row.kind]}>
            {row.before}
            {row.text}
            {row.after}
            {/* THE SEPARATOR IS A REAL TEXT NODE, and it is not decoration.
                Splitting the sentence into block elements splits its TEXT
                CONTENT too, and without this the line reads "…choose — then
                taught…" on screen but concatenates as "thentaught" — which is
                what a copy-paste, a page search and an assistive reader all
                get. Caught by e2e asserting the leaf contains `ketsu.line`.
                A trailing space collapses visually, so it costs nothing. */}
            {i < rows.length - 1 ? ' ' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The row's own links: ink, underlined, and never pink — the sheet's one law. */
const CONTACT_LINK: CSSProperties = {
  color: PALETTE.ink,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

const BASE_ROW: CSSProperties = {
  fontFamily: 'var(--sw-font-panel)',
  color: PALETTE.ink,
  letterSpacing: '0.02em',
  lineHeight: 1.22,
}

/**
 * The sheet's registers. NO PINK anywhere on it: pink is the hero number's
 * semantic channel and the moment it decorates, numbers stop reading as the point.
 */
const ROW_STYLE: Record<'premise' | 'name' | 'says' | 'line' | 'contact', CSSProperties> = {
  /**
   * The eyebrow: what the document IS, above whose it is.
   *
   * The smallest register on the sheet, and 10px rather than the lab's 11px
   * lettering floor because that floor governs type set inside PRINTED INK — a
   * balloon interior cannot reflow — while this is set on paper the site draws
   * and may wrap. `says` and `contact` have sat at 10px since Task 82 for the
   * same reason; a fourth number here would be a fourth rule.
   */
  premise: {
    ...BASE_ROW,
    fontFamily: 'var(--sw-font-body)',
    fontSize: 'max(10px, 3cqw)',
    letterSpacing: '0.06em',
    opacity: 0.66,
    marginBottom: '0.5cqw',
    // BALANCED, because captured at 390 it broke as "…one lap of a tiny" /
    // "planet" — a one-word last line, directly above her name, on the row whose
    // whole job is to be read past. Two even lines or one; never an orphan.
    textWrap: 'balance',
  },
  name: { ...BASE_ROW, fontSize: 'max(13px, 6.6cqw)', lineHeight: 1.06 },
  says: {
    ...BASE_ROW,
    fontFamily: 'var(--sw-font-body)',
    fontSize: 'max(10px, 3.5cqw)',
    opacity: 0.9,
    marginBottom: '0.6cqw',
  },
  /**
   * THE HOOK LINE — the one sentence each chapter is allowed, and after Task 105
   * the loudest thing on the sheet.
   *
   * Aram: the bottom of the card should be more noticeable. This is the row that
   * carries the claim ("Eight months on a sports platform. All the small stuff"),
   * so it takes the emphasis rather than the colophon under it: a step of size
   * and a px floor one point up, inside the face the sheet already uses. It is
   * still well under `name`, which is the only row on the page allowed to be a
   * heading.
   */
  line: { ...BASE_ROW, fontSize: 'max(12px, 5.6cqw)' },
  contact: {
    ...BASE_ROW,
    fontFamily: 'var(--sw-font-body)',
    fontSize: 'max(10px, 3.4cqw)',
    opacity: 0.82,
    marginTop: '0.9cqw',
  },
}
