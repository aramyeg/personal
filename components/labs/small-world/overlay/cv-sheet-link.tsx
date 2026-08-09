'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { PALETTE } from '../palette'
import { NO_TAP_HIGHLIGHT, PRESS_SHIFT_PX, isKeyboardFocus } from './control-states'
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
 *
 * ============================================================================
 * IT HAD NO STATES OF ITS OWN, SO THE PLATFORM SUPPLIED THEM (Task 105)
 * ============================================================================
 * A bare `<button>` on paper gets the browser's default focus ring, which on this
 * stock is a black box around the word, and a phone adds its own grey tap flash
 * on top. Aram saw the first of those as "some sort of black border" on the
 * clicked state. Both are replaced here rather than removed: an INK ring on
 * keyboard focus (see `control-states.ts` for why it is keyboard and not focus),
 * and a press that moves the word a pixel the way a pen does. Ink on the sheet's
 * paper is 13.6:1 — the same measurement the ending's ring was chosen on — and
 * still no pink, for the reason above.
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
  borderRadius: 3,
  ...NO_TAP_HIGHLIGHT,
}

/** Paper inside, ink outside — the ring reads on the sheet without touching the word. */
const FOCUS_RING = `0 0 0 2px ${PALETTE.pagePaper}, 0 0 0 4px ${PALETTE.ink}`

export function CvSheetLink() {
  const [focused, setFocused] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      data-testid={CV_SHEET_LINK_TESTID}
      onClick={openCv}
      onFocus={(e) => setFocused(isKeyboardFocus(e.target))}
      onBlur={() => setFocused(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...style,
        boxShadow: focused ? FOCUS_RING : undefined,
        transform: pressed ? `translateY(${PRESS_SHIFT_PX}px)` : undefined,
      }}
    >
      {CV_LABEL}
    </button>
  )
}
