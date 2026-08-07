'use client'
import type { CSSProperties } from 'react'
import { chapters } from '../chapters'
import { INFO_PAGES } from './info-page-spec'
import { PALETTE } from '../palette'

/**
 * THE TITLE CARD — her name, at the top of her own book.
 *
 * ============================================================================
 * WHY IT EXISTS
 * ============================================================================
 * The blind audit's plainest finding, and the one that is hardest to argue with:
 * ALWINA'S NAME APPEARED NOWHERE IN THE PIECE. Six chapters, a manga, a desk, a
 * signature at the end — and a recruiter could read the whole thing without
 * learning whose CV it was. A portfolio that does not say who it is about has
 * failed at the first thing a portfolio does.
 *
 * So the journey opens on a title, the way a book does. It is up before the first
 * chapter and gone once she starts walking.
 *
 * ============================================================================
 * WHAT IT SAYS, AND WHERE THE NUMBERS COME FROM
 * ============================================================================
 * Name, what she is now, and how long she has been doing it. The role is the
 * FIRST chapter's — no: it is the LATEST chapter's, because "Frontend Engineer"
 * is what she is, not what she was. The years are DERIVED from the story's own
 * first and last periods rather than typed, so a new chapter moves them and a
 * stale "6+ years" cannot survive an edit.
 *
 * The line under it is her opening hook, which is the first thing the strip would
 * have said anyway — the title card is the same promise made once, up front.
 *
 * ============================================================================
 * IT IS PAPER, NOT UI
 * ============================================================================
 * Same stock, same ink, same hard shadow as the leaves it introduces. A title
 * card in a different language from the book it opens is a splash screen.
 */

/** The first year that appears in the story, and the last — both parsed, never typed. */
function span(): { from: number; to: string } {
  const years = INFO_PAGES.map((p) => p.footer.period)
  const first = Number(/\d{4}/.exec(years[0])?.[0] ?? '0')
  const last = years[years.length - 1]
  return { from: first, to: /now|present/i.test(last) ? 'now' : (/(\d{4})\s*$/.exec(last)?.[1] ?? 'now') }
}

/**
 * Years of PROFESSIONAL work — from the first job, not from the first chapter.
 *
 * Chapter 1 is her degree, and counting a Master's as experience is the kind of
 * inflation this piece has no reason to reach for. So the count starts at chapter
 * 2, which is where `IU Networks` begins.
 */
function yearsWorking(): number {
  const firstJob = Number(/\d{4}/.exec(INFO_PAGES[1].footer.period)?.[0] ?? '0')
  const end = span().to === 'now' ? new Date().getFullYear() : Number(span().to)
  return Math.max(1, end - firstJob)
}

export function TitleCard({ present }: { present: number }) {
  if (present <= 0) return null
  const years = yearsWorking()
  const style: Record<string, string | number> = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translateY(${(1 - present) * -14}px) rotate(-1.2deg)`,
    opacity: present,
    width: 'min(86vw, 520px)',
    background: PALETTE.pagePaper,
    border: `4px solid ${PALETTE.ink}`,
    borderRadius: 6,
    boxShadow: `8px 10px 0 ${PALETTE.ink}`,
    padding: '22px 26px 18px',
    boxSizing: 'border-box',
    textAlign: 'center',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  }
  return (
    <div data-testid="sw-title-card" style={style as CSSProperties}>
      <span
        data-sw-text="title-name"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 'clamp(26px, 4.4vw, 44px)',
          lineHeight: 1,
          letterSpacing: '0.01em',
          color: PALETTE.ink,
        }}
      >
        Alwina Harutyunyan
      </span>
      <span
        data-sw-text="title-role"
        style={{
          fontFamily: 'var(--sw-font-panel)',
          fontSize: 'clamp(13px, 1.7vw, 18px)',
          letterSpacing: '0.08em',
          lineHeight: 1.1,
          color: PALETTE.blossomDeep,
        }}
      >
        {INFO_PAGES[INFO_PAGES.length - 1].footer.role} · {years}+ years
      </span>
      <span
        data-sw-text="title-line"
        style={{
          fontFamily: 'var(--sw-font-body)',
          fontSize: 'clamp(11px, 1.15vw, 14px)',
          lineHeight: 1.35,
          color: PALETTE.ink,
          opacity: 0.82,
          marginTop: 2,
        }}
      >
        {chapters[0].hook}
      </span>
    </div>
  )
}
