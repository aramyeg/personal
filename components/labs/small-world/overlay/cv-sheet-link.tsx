'use client'
import type { CSSProperties } from 'react'
import { PALETTE } from '../palette'
import { CV_LABEL, CV_SHEET_LINK_TESTID, openCv } from './cv-open'

/**
 * THE FIRST DOOR — the plain CV, offered on the first sheet the chibi unrolls.
 *
 * ============================================================================
 * WHY IT IS ON THE CONTACT ROW AND NOT ON A ROW OF ITS OWN
 * ============================================================================
 * The sheet is `flex: 0 0 auto` and the hero panel takes what is left, so a line
 * added here is a line taken off the hero — and on chapter 1, the sheet that
 * carries her name, that panel is already measured at 112px. Task 82 paid for
 * this twice: reserving one row for the reaction bust pushed the SELF-TAUGHT
 * wordmark out of its panel and onto the photograph above it.
 *
 * So this rides the row that is already there, after her LinkedIn, where a reader
 * looking for how to reach her is already looking. Same row, same height, no
 * change to the hero's budget — verified by capture rather than assumed.
 *
 * ============================================================================
 * IT IS A LINK, AND IT LOOKS LIKE ONE
 * ============================================================================
 * The genre-wide failure Task 77 found is not omitting the plain view, it is
 * hiding it — one site links its nowhere, another ships an unlabelled printer
 * icon. So: a word, not a glyph; full-strength ink where the contact beside it
 * runs at 0.82; and an underline, which is the one mark every reader already
 * reads as "this goes somewhere".
 *
 * NO PINK. It would be the obvious way to make it louder and it is forbidden here:
 * pink is the hero number's semantic channel on this leaf, and the moment it
 * decorates, numbers stop reading as numbers (`cloth-drag.tsx`).
 *
 * THE HIT AREA IS BIGGER THAN THE TYPE. At the phone's sheet width this sets
 * around 12px, which is a fine thing to read and a poor thing to hit. The padding
 * is cancelled by an equal negative margin, so the target grows and the row does
 * not move.
 */

/**
 * One step up from the contact line it sits on (which is `max(10px, 3.4cqw)`),
 * with a 12px floor: the lab's lettering floor is 11px and a link a reader has to
 * find should not be sitting on it.
 */
const FONT = 'max(12px, 3.8cqw)'

const style: CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  fontFamily: 'var(--sw-font-body)',
  fontSize: FONT,
  lineHeight: 'inherit',
  letterSpacing: 'inherit',
  color: PALETTE.ink,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  padding: '7px 5px',
  margin: '-7px -5px',
  pointerEvents: 'auto',
}

export function CvSheetLink() {
  return (
    <button type="button" data-testid={CV_SHEET_LINK_TESTID} onClick={openCv} style={style}>
      {CV_LABEL}
    </button>
  )
}
