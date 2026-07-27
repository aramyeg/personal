/**
 * SPREAD 5 SCENE GATES — the Vault-Dragon's two handles must be FINDABLE, and
 * the spread's one invitation must point at its payoff.
 *
 * A context-quarantined blind reader played chapter IV and reported:
 *
 *  S5-1  "Only 2 of ~15 scene objects are interactive, and both handles are
 *         near-invisible. The right handle is a 100x25px flat grey plate
 *         floating in the black off-page void; the left handle is a ~14x25px
 *         gold splinter... I found the grey plate only because I brute-force-
 *         swept a 1500-point hover grid. Nobody will find the left one."
 *  S5-7  "The story's climax is invisible at rest. The golden arcade behind the
 *         left panel is the best image on the spread and the literal payoff of
 *         the text — and at rest it is completely hidden behind a card that
 *         reads as unrelated wall art, gated behind the least discoverable
 *         control here."
 *
 * The fixes are geometric (wider tongues), structural (the rack's own slats
 * raycast into the same grab) and editorial (the beckon's tie-break). This file
 * gates all three in the units the reader actually experienced them: SCREEN
 * PIXELS at the pinned reading camera, derived from content.ts's own numbers and
 * book-scene.tsx's own camera — never eyeballed off a screenshot.
 */

import { describe, expect, it } from 'vitest'
import {
  solveDissolvePose,
  dissolveTabQuad,
  dissolveTabOut,
  dissolveTabTip,
  dissolveStroke,
  DISSOLVE_TAB_LIP,
} from '@/components/labs/storybook/book/popup-dissolve'
import { solveTabPiecePose } from '@/components/labs/storybook/book/popup-tabpiece'
import { spreadPageAnglesTilted, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { primaryPlayableChannel } from '@/components/labs/storybook/book/handle-beckon'
import { HANDLE_MIN_HIT, HANDLE_SLOP_FLAT, handleSlopFactor } from '@/components/labs/storybook/book/handle-hit'
import { PAGE_W } from '@/components/labs/storybook/book/page-geometry'
import { popupContentForSpread } from '@/components/labs/storybook/content'
import { screenBox, shortestEdge } from './reading-camera'

// The pinned reading camera and its projection live in ./reading-camera.ts —
// one copy for every file that makes a screen-px claim (S5R2 lifted it out when
// s5-round2.test.ts needed the same numbers).

const s5 = popupContentForSpread(5)
if (!s5) throw new Error('spread 5 missing')
const goldpile = s5.layers.find((l) => l.id === 'ch4-goldpile')
const dissolve = s5.layers.find((l) => l.id === 'ch4-dissolve')
if (!goldpile || goldpile.mech !== 'tabpiece') throw new Error('ch4-goldpile missing or wrong mech')
if (!dissolve || dissolve.mech !== 'dissolve') throw new Error('ch4-dissolve missing or wrong mech')
const { thetaL, thetaR } = spreadPageAnglesTilted(5, 5, null, 0)

/** What the blind reader measured, in the same units: the two handles before the
 *  fix. Every "must be bigger than" below is anchored to these, so a future edit
 *  that quietly shrinks a tongue back reopens the finding instead of passing. */
const REPORTED = {
  goldpileTab: { w: 100, h: 25 },
  dissolveTab: { w: 14, h: 25 },
} as const

describe('S5-1 — both pull handles are big enough for a first-time reader to FIND', () => {
  it('the gold pile\'s tongue is as wide as the strip that drives it', () => {
    // A tab may not be wider than the paper it is cut from: the strip spans the
    // piece's own z band, so tabW <= z1 - z0 is the honest ceiling.
    expect(goldpile.tabW).toBeDefined()
    expect(goldpile.tabW as number).toBeLessThanOrEqual(goldpile.z1 - goldpile.z0)
    expect(goldpile.tabW as number).toBeGreaterThan(0.2)
  })

  it('the gold pile tab clears the reader-scale hit floor and beats the reported sliver', () => {
    const tab = solveTabPiecePose(goldpile, thetaL, thetaR).find((p) => p.face === 'tab')
    if (!tab) throw new Error('tabpiece pose has no tab patch')
    expect(shortestEdge(tab.quad)).toBeGreaterThanOrEqual(HANDLE_MIN_HIT)
    const box = screenBox(tab.quad)
    expect(box.h).toBeGreaterThan(REPORTED.goldpileTab.h * 2)
    expect(box.area).toBeGreaterThan(REPORTED.goldpileTab.w * REPORTED.goldpileTab.h * 3)
  })

  it('the dissolve tongue reaches past the fore edge AT REST, and by paper not by drive', () => {
    expect(dissolveTabTip(dissolve, thetaL - thetaR)).toBeGreaterThan(0)
    // The tongue is cut paper, NOT a change to the strip law: draw still equals
    // protrusion exactly, so the inextensibility gate (D2/D7) is untouched.
    expect(dissolveTabOut(dissolve, 0)).toBeCloseTo(0, 12)
    expect(dissolveTabOut(dissolve, Math.PI)).toBeCloseTo(dissolveStroke(dissolve), 12)
    // ...and the tongue at rest still reaches less far than the piece already
    // reached in its latched-gold state, so nothing newly leaves the trim.
    expect(dissolveTabTip(dissolve, thetaL - thetaR)).toBeLessThan(dissolveStroke(dissolve))
  })

  it('the tongue is TAKEN UP by the closing book — flush at book-closed', () => {
    // The containment law (popup-mechanics A4) is absolute: at book-closed
    // nothing reaches past the fore edge. The slack take-up is what keeps a
    // proud tongue legal, so gate its two ends and its monotonicity.
    expect(dissolveTabTip(dissolve, 0)).toBeCloseTo(0, 12)
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const beta = (Math.PI * i) / 20
      const tip = dissolveTabTip(dissolve, beta)
      expect(tip).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = tip
    }
    const closedTab = dissolveTabQuad(dissolve, 0, Math.PI, Math.PI)
    for (const p of closedTab) expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(PAGE_W + 1e-9)
  })

  it('the dissolve tab clears the hit floor at rest and beats the reported splinter', () => {
    const tab = dissolveTabQuad(dissolve, 0, thetaL, thetaR)
    // The tongue's own short edge is the reach past the slit — a page-flat
    // handle, so the reader's effective target is that quad grown by the flat
    // slop pad. Gate the pad's RESULT against the touch-target floor (the pad
    // must not be doing all the work: the die-cut itself carries more than
    // half of it, unlike the 0.02 bare lip it replaced).
    const raw = shortestEdge(tab)
    expect(raw).toBeGreaterThan(DISSOLVE_TAB_LIP * 3)
    expect(raw * handleSlopFactor(tab, HANDLE_SLOP_FLAT)).toBeGreaterThanOrEqual(HANDLE_MIN_HIT)
    const box = screenBox(tab)
    expect(box.h).toBeGreaterThan(REPORTED.dissolveTab.h * 2)
    expect(box.area).toBeGreaterThan(REPORTED.dissolveTab.w * REPORTED.dissolveTab.h * 5)
  })

  it('the dissolve tongue stays clear of the narration column that hid the other tab', () => {
    // D6 relearned: a handle behind the HTML plaque is a handle that does not
    // exist. The left column's last line ("...lease out carriages.") ends at
    // screen x 213 in the 1600x900 frame; the tongue must not reach under it.
    const NARRATION_TAIL_X = 213
    const box = screenBox(dissolveTabQuad(dissolve, 0, thetaL, thetaR))
    expect(box.x0).toBeGreaterThan(NARRATION_TAIL_X)
  })

  it('the tab still exits the page at the slit, never floating free of it', () => {
    const u: Vec3 = [Math.cos(thetaL), Math.sin(thetaL), 0]
    for (const tau of [0, Math.PI / 2, Math.PI]) {
      const tab = dissolveTabQuad(dissolve, tau, thetaL, thetaR)
      const minD = Math.min(...tab.map((p) => p[0] * u[0] + p[1] * u[1]))
      // the inner edge stays INSIDE the fore edge by the grabbable lip
      expect(minD).toBeCloseTo(PAGE_W - DISSOLVE_TAB_LIP, 9)
      const maxD = Math.max(...tab.map((p) => p[0] * u[0] + p[1] * u[1]))
      expect(maxD).toBeLessThanOrEqual(PAGE_W + dissolveTabTip(dissolve, thetaL - thetaR) + dissolveStroke(dissolve) + 1e-9)
    }
  })
})

describe('S5-1 — the rack itself is a grab surface, so the picture answers a press', () => {
  it('the slats and base present far more area than the tongue ever could', () => {
    const pose = solveDissolvePose(dissolve, 0, thetaL, thetaR)
    const tabArea = screenBox(pose.tab).area
    const bodyArea = screenBox(pose.base).area
    expect(bodyArea).toBeGreaterThan(tabArea * 3)
    // every slat is individually a reader-scale target
    for (const slat of pose.slats) {
      expect(screenBox(slat).area).toBeGreaterThan(45 * 45)
    }
  })

  it('a body drag reads the SAME draw as a tongue drag (one degree of freedom)', () => {
    // The drive projects the pointer onto the page's fore axis, not onto the
    // surface it landed on — so pressing a slat and pressing the tab are the
    // same arithmetic. Gate it as the identity it is: equal fore-axis travel
    // must map to equal tau, wherever the press began.
    const stroke = dissolveStroke(dissolve)
    for (const delta of [0, stroke / 4, stroke / 2, stroke]) {
      const fromTab = Math.PI * Math.min(1, delta / stroke)
      const pose = solveDissolvePose(dissolve, fromTab, thetaL, thetaR)
      expect(dissolveTabOut(dissolve, fromTab)).toBeCloseTo(delta, 9)
      expect(pose.slats).toHaveLength(dissolve.slats)
    }
  })
})

describe('S5-7 — the spread invites the reader toward its payoff, not away from it', () => {
  it('the beckon picks the dissolve (the golden-arcade reveal), not the gold pile', () => {
    expect(primaryPlayableChannel(5)).toBe('ch4-dissolve')
  })

  it('the tie-break is content order, so the dissolve is listed first on purpose', () => {
    const ids = s5.layers.map((l) => l.id)
    expect(ids.indexOf('ch4-dissolve')).toBeLessThan(ids.indexOf('ch4-goldpile'))
  })
})
