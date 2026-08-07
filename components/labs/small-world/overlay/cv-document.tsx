'use client'
import type { CSSProperties } from 'react'
import {
  ALWINA,
  CONTACT_HREF,
  DEGREE,
  LANGUAGES,
  ROLES_NEWEST_FIRST,
  STACK,
  periodLong,
  type Credit,
} from '../alwina-cv'
import { PALETTE } from '../palette'
import { CV_DOC_TESTID } from './cv-open'

/**
 * THE PLAIN CV — the escape hatch's whole content, and deliberately the quietest
 * thing in the lab.
 *
 * ============================================================================
 * WHY A PLAIN PAGE IS A DELIVERABLE AND NOT A CONCESSION
 * ============================================================================
 * Task 77 surveyed ~25 story-shaped portfolios and came back with one
 * non-negotiable: ONE plain, dense, readable view — name, roles with employers
 * and dates, languages, stack, contact — reachable early and made of real text.
 * The genre-wide failure is not omitting it, it is HIDING it (one site links its
 * plain version nowhere; another ships an unlabelled printer icon). The working
 * precedent was a plain routed page one click behind the world.
 *
 * So this page does not try to be charming. The little world is the charm budget
 * and it has already been spent; a recruiter who came here came for the facts.
 *
 * ============================================================================
 * THE CONTENT IS THE APPROVED SHEET BLOCK, AND NOTHING ELSE
 * ============================================================================
 * Every line is `.superpowers/sdd/task-80-report.md` ROUND 3 §2, verbatim, plus
 * the contact. There are NO section headings, and that is a decision rather than
 * an omission: the pack's own structure is four blank-line-separated groups, and
 * inventing "Experience" / "Education" over them would be writing copy for a real
 * person's CV that nobody approved. The groups are spaced instead, which is what
 * the blank lines meant.
 *
 * There is no email. Her real address is not known to this repo and a
 * plausible-looking invented one is the worst available failure on a page whose
 * entire job is being trustworthy.
 *
 * ============================================================================
 * INK ON PAPER, AND EXACTLY ONE PINK
 * ============================================================================
 * Near-white stock, ink type, and the lab's pink spent once — on the hairline
 * under her name, where it says "this page came from that world" without
 * decorating a single fact. Ink on this paper measures 13.6:1.
 *
 * ============================================================================
 * PRINTING IS ITS REAL USE
 * ============================================================================
 * This is the closest thing the lab has to the genre's vanilla CV, and a
 * recruiter will hit Ctrl+P. The print rules live in `cv-overlay.tsx` because
 * they are about the DOCUMENT the page sits in (hiding a 1600vh scroll track that
 * would otherwise print as forty blank sheets); what belongs here is that nothing
 * below depends on a background colour surviving, and every group is
 * `break-inside: avoid` so a page break never lands inside a job.
 */

/**
 * THE TYPE FLOORS, NAMED SO THEY CAN BE GATED.
 *
 * The lab's lettering floor is 11px (`manga/lettering.ts`) and the phone is where
 * a ratio-based size goes under it. Every size on this page is a `clamp()` whose
 * MINIMUM is one of these, so the narrow viewport lands on the floor by
 * construction rather than by a screenshot somebody looked at once. The test
 * asserts each one against the lab's own floor, and the 390 capture confirms it.
 */
export const CV_TYPE_FLOOR_PX = {
  name: 26,
  says: 15,
  /** A role, the degree, and the contact — the page's body register. */
  line: 15,
  /** The languages and stack rows, which are the longest and may run a size down. */
  meta: 14,
} as const

const size = (floor: number, vw: number, cap: number) => `clamp(${floor}px, ${vw}vw, ${cap}px)`

/**
 * The measure the one PROSE line is allowed to run to.
 *
 * It applies to the identity line and to nothing else. The credit rows are single
 * facts rather than sentences, and holding them to a reading measure is what put
 * "2019" alone on a line under the degree — captured, at 1440.
 */
const MEASURE = '34em'

const doc: CSSProperties = {
  background: PALETTE.pagePaper,
  color: PALETTE.ink,
  fontFamily: 'var(--sw-font-body), ui-sans-serif, system-ui, sans-serif',
  // Read as a document, not as a card: generous side margins on paper, tight on a phone.
  padding: 'clamp(22px, 5vw, 46px) clamp(20px, 5vw, 52px)',
  boxSizing: 'border-box',
  textAlign: 'left',
}

const name: CSSProperties = {
  fontSize: size(CV_TYPE_FLOOR_PX.name, 6.4, 34),
  fontWeight: 800,
  letterSpacing: '-0.015em',
  lineHeight: 1.08,
  margin: 0,
  color: PALETTE.ink,
}

const says: CSSProperties = {
  fontSize: size(CV_TYPE_FLOOR_PX.says, 3.6, 17),
  lineHeight: 1.45,
  margin: '6px 0 0',
  opacity: 0.78,
  maxWidth: MEASURE,
}

/**
 * THE ONE PINK. Short, and under the identity block rather than across the page:
 * a rule the full width would be a divider, and a divider is furniture.
 */
const rule: CSSProperties = {
  border: 0,
  borderTop: `2px solid ${PALETTE.blossomDeep}`,
  width: 52,
  margin: 'clamp(16px, 3vw, 22px) 0 clamp(18px, 3.4vw, 26px)',
  // A hairline that a printer drops takes the page's only colour with it.
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
} as CSSProperties

const group: CSSProperties = {
  margin: '0 0 clamp(16px, 3vw, 24px)',
  padding: 0,
  listStyle: 'none',
  breakInside: 'avoid',
}

const line: CSSProperties = {
  fontSize: size(CV_TYPE_FLOOR_PX.line, 3.4, 16),
  lineHeight: 1.5,
  margin: '0 0 4px',
  breakInside: 'avoid',
}

const meta: CSSProperties = {
  fontSize: size(CV_TYPE_FLOOR_PX.meta, 3.2, 15),
  lineHeight: 1.55,
  margin: '0 0 6px',
  opacity: 0.9,
  breakInside: 'avoid',
}

const contact: CSSProperties = {
  ...line,
  margin: 'clamp(18px, 3.4vw, 26px) 0 0',
}

const link: CSSProperties = {
  color: PALETTE.ink,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

/**
 * One credit, as ONE LINE OF TEXT.
 *
 * The title is set apart by WEIGHT and not by structure, and that is load-bearing:
 * splitting a line into block elements splits its text content too, which is what
 * `copy-paste`, a page search and a screen reader receive. Task 82 shipped
 * "thentaught" to all three by exactly that route. Every separator below is a real
 * text node inside one inline flow, so `textContent` is the pack's own line and
 * the test asserts it against `creditLine`.
 */
function CreditLine({ credit, style }: { credit: Credit; style: CSSProperties }) {
  return (
    <li style={style}>
      <strong style={{ fontWeight: 700 }}>{credit.title}</strong>
      {' — '}
      {credit.org}
      {' · '}
      {/* THE DATE NEVER BREAKS. Captured on the phone: `IU Networks · 2020–` sat at the
          end of one line with `2021` alone on the next, which reads as two facts. The
          line may wrap — a phone gives it no choice — but not through a range. */}
      <span style={{ whiteSpace: 'nowrap' }}>{periodLong(credit)}</span>
    </li>
  )
}

/** A labelled fact row: `Languages — English, Russian, …`, one inline flow. */
function MetaRow({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <li style={meta}>
      <strong style={{ fontWeight: 700 }}>{label}</strong>
      {' — '}
      {items.join(', ')}
    </li>
  )
}

/** The id the dialog is labelled by, so the heading names it rather than a second string. */
export const CV_HEADING_ID = 'sw-cv-name'

export function CvDocument() {
  return (
    <article data-sw-cv-doc="" data-testid={CV_DOC_TESTID} style={doc}>
      <h1 id={CV_HEADING_ID} style={name}>
        {ALWINA.name}
      </h1>
      <p style={says}>{ALWINA.says}</p>
      <hr style={rule} />

      <ul style={group}>
        {ROLES_NEWEST_FIRST.map((c) => (
          <CreditLine key={`${c.org}-${c.from}`} credit={c} style={line} />
        ))}
      </ul>

      <ul style={group}>
        <CreditLine credit={DEGREE} style={line} />
      </ul>

      <ul style={group}>
        <MetaRow label="Languages" items={LANGUAGES} />
        <MetaRow label="Stack" items={STACK} />
      </ul>

      <p style={contact}>
        <a href={CONTACT_HREF} target="_blank" rel="noopener noreferrer" style={link}>
          {ALWINA.contact}
        </a>
      </p>
    </article>
  )
}
