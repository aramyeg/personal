/**
 * SPREAD 5, ROUND 2 — the blind re-reader's four mechanical findings, each
 * pinned in the units they were reported in.
 *
 *  S5R2-2  "Mechanism state survives leaving and returning to the spread. Turn
 *           the page away and back and the flattened tent is still flattened
 *           (measured: 660 changed px, i.e. identical). A real pop-up re-pops
 *           when you re-open it."
 *  S5R2-3  "The invisible page-turn corner hotspots overlap both movers...
 *           hovering the panel simultaneously lights up the dog-ear while the
 *           cursor shows a pinch grip — two contradictory promises at one pixel
 *           — and clicking there fires neither."
 *  S5R2-4a "A 20px drag does nothing at all; a 35px drag produces the identical
 *           final frame as a 250px drag. It is a threshold toggle wearing a
 *           drag's clothes — I never once felt I was turning the slats myself."
 *  S5R2-4b "No detent anywhere, including at the pose the scene ships in, and
 *           dragging back the same distance does not return it... The designed
 *           silhouette is destroyed on first touch and cannot be recovered by
 *           feel."
 *
 * Every screen-px claim below comes from the pinned reading camera
 * (./reading-camera.ts) applied to content.ts's own geometry — never a number
 * off a screenshot. The live counterparts are scripts/storybook/bench/
 * s5r2-probe.mjs and s5r2-corner-map.mjs.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  DISSOLVE_DETENT,
  DISSOLVE_ENDS,
  dissolveDetent,
  dissolveHoldEnvelope,
  dissolveShownTau,
  dissolveSlatAt,
  dissolveSlatHinge,
  dissolveStroke,
  dissolveTabOut,
  dissolveTabQuad,
  dissolveTapTarget,
  dissolveTauFromDraw,
  solveDissolvePose,
} from '@/components/labs/storybook/book/popup-dissolve'
import {
  TABPIECE_DETENT,
  solveTabPiecePose,
  solveTabPiecePoseAt,
  tabPieceCamShape,
  tabPieceDetent,
  tabPieceLift,
  tabPieceRestLift,
  tabPieceStopLift,
} from '@/components/labs/storybook/book/popup-tabpiece'
import { spreadPageAnglesTilted, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { crankTangentialDelta } from '@/components/labs/storybook/book/handle-projection'
import { PAGE_W } from '@/components/labs/storybook/book/page-geometry'
import { commitSpread } from '@/components/labs/storybook/book/use-turn-driver'
import { popupContentForSpread } from '@/components/labs/storybook/content'
import {
  cornerTurnAt,
  cornerTurnFor,
  sceneOwnsPointer,
  CORNER_W_PCT,
  CORNER_H_PCT,
  CORNER_SIDE_PCT,
  CORNER_BOTTOM_PCT,
} from '@/components/labs/storybook/overlay/corner-hotspot'
import { listUserDriveIds, readUserDrive, resetUserDrives, writeUserDrive } from '@/components/labs/storybook/user-drive'
import { FRAME_H, FRAME_W, boxesOverlap, screenBox, toScreen, type ScreenBox } from './reading-camera'

const deg = (r: number): number => (r * 180) / Math.PI

const s5 = popupContentForSpread(5)
if (!s5) throw new Error('spread 5 missing')
const dissolve = s5.layers.find((l) => l.id === 'ch4-dissolve')
const goldpile = s5.layers.find((l) => l.id === 'ch4-goldpile')
if (!dissolve || dissolve.mech !== 'dissolve') throw new Error('ch4-dissolve missing or wrong mech')
if (!goldpile || goldpile.mech !== 'tabpiece') throw new Error('ch4-goldpile missing or wrong mech')
const { thetaL, thetaR } = spreadPageAnglesTilted(5, 5, null, 0)
const REST_BETA = thetaL - thetaR

// ---------------------------------------------------------------------------
// S5R2-2 — A REOPENED PAGE IS A FRESH POP-UP

describe('S5R2-2 — leaving the spread drops what the reader was holding', () => {
  beforeEach(() => resetUserDrives())
  afterEach(() => resetUserDrives())

  it('advancing the committed spread is what clears the channels', () => {
    writeUserDrive('ch4-goldpile', 0.9)
    writeUserDrive('ch4-dissolve', Math.PI)
    const ref = { current: 5 }
    commitSpread(ref, 6)
    expect(ref.current).toBe(6)
    expect(listUserDriveIds()).toEqual([])
  })

  it('the reset is idempotent — a frame that changes nothing keeps the values', () => {
    // The driver calls this every frame with the same number at rest; a reset
    // there would wipe the reader's flip while they were still looking at it.
    writeUserDrive('ch4-dissolve', 1.2)
    const ref = { current: 5 }
    commitSpread(ref, 5)
    commitSpread(ref, 5)
    expect(readUserDrive('ch4-dissolve')).toBe(1.2)
  })

  it('the ROOT CAUSE cannot come back: the commit path resets before it syncs', () => {
    // The bug was a top-of-frame `committedSpread.current !== spread` test whose
    // change had already been consumed by the commit branch below it. Advancing
    // the ref and dropping the drives are one function now, so a caller that
    // advances the ref can no longer skip the reset by construction — assert it
    // over the whole s4->s5->s6 walk a reader actually makes.
    const ref = { current: 4 }
    for (const next of [5, 6, 5, 4]) {
      writeUserDrive('ch4-goldpile', 0.7)
      commitSpread(ref, next)
      expect(ref.current).toBe(next)
      expect(listUserDriveIds()).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S5R2-4a — THE DISSOLVE IS A DIAL, NOT A LIGHT SWITCH
//
// Screen px -> strip draw, at the pinned camera: the drive projects the pointer
// onto the page's fore axis, so one screen px is worth (stroke / the tongue's
// own screen travel over that stroke) of draw. Derived from the piece's own tab
// quad at the two ends — never the 2.6 deg/px the live probe measured, which is
// the number this ratio has to REPRODUCE.
/** The tongue's own outer tip (quad corners 2,3 are the far edge). */
const tongueTip = (tau: number): [number, number] => {
  const q = dissolveTabQuad(dissolve, tau, thetaL, thetaR)
  return toScreen([(q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2, (q[2][2] + q[3][2]) / 2])
}
const TONGUE_TRAVEL_PX = Math.hypot(tongueTip(Math.PI)[0] - tongueTip(0)[0], tongueTip(Math.PI)[1] - tongueTip(0)[1])
const drawPerPx = dissolveStroke(dissolve) / TONGUE_TRAVEL_PX
/** The flip a press-drag of `px` along the strip axis asks for, from rest. */
const flipForPx = (px: number): number => dissolveDetent(dissolveTauFromDraw(dissolve, px * drawPerPx))

describe('S5R2-4a — the dissolve grades under the hand and keeps what it was given', () => {
  it('reproduces the live gearing the probe measured (2.6 deg of flip per px)', () => {
    expect(deg(flipForPx(10)) / 10).toBeGreaterThan(1.5)
    expect(deg(flipForPx(10)) / 10).toBeLessThan(4)
  })

  it('35px and 250px are no longer the same frame — the finding, inverted', () => {
    expect(flipForPx(250)).toBeCloseTo(Math.PI, 6)
    expect(Math.abs(flipForPx(35) - flipForPx(250))).toBeGreaterThan(0.5)
  })

  it('every stroke length lands somewhere of its own', () => {
    const taus = [10, 20, 25, 35, 50].map(flipForPx)
    for (let i = 1; i < taus.length; i++) {
      expect(taus[i]).toBeGreaterThan(taus[i - 1] + 0.05)
    }
    // ...and a 20px drag is no longer "nothing at all": it moves the slats far
    // enough that the rack's own screen silhouette changes.
    const flat = screenBox(solveDissolvePose(dissolve, 0, thetaL, thetaR).slats[0])
    const tipped = screenBox(solveDissolvePose(dissolve, flipForPx(20), thetaL, thetaR).slats[0])
    expect(Math.abs(tipped.h - flat.h) + Math.abs(tipped.w - flat.w)).toBeGreaterThan(8)
  })

  it('both pure faces are poses the hand LANDS on, not near', () => {
    for (const end of DISSOLVE_ENDS) {
      expect(dissolveDetent(end)).toBeCloseTo(end, 12)
      // Anywhere inside the sticky band's inner hold, the drive is exactly the end.
      const inside = end === 0 ? DISSOLVE_DETENT * 0.3 : Math.PI - DISSOLVE_DETENT * 0.3
      expect(dissolveDetent(inside)).toBeCloseTo(end, 9)
    }
    // Away from both bands it is the identity — nothing else is bent.
    expect(dissolveDetent(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 12)
  })

  it('the detent is monotone, so the paper never jumps backwards under the hand', () => {
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const v = dissolveDetent((Math.PI * i) / 400)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
  })

  it('a click on the rack shows the other face', () => {
    expect(dissolveTapTarget(0)).toBeCloseTo(Math.PI, 12)
    expect(dissolveTapTarget(Math.PI)).toBeCloseTo(0, 12)
    // A rack left mid-flip commits to whichever face it is NOT already nearer.
    expect(dissolveTapTarget(0.2)).toBeCloseTo(Math.PI, 12)
    expect(dissolveTapTarget(Math.PI - 0.2)).toBeCloseTo(0, 12)
  })
})

describe('S5R2-4a — the hold envelope replaces the snap, and pays the fold-flat bill', () => {
  it('a held flip renders essentially itself at the rest dihedral', () => {
    // The envelope is normalised at the family's 176-degree rest, and the
    // spread's own tilted rest sits a hair off it — so this is 1 to five places,
    // not by construction. What matters is that nothing about the shipped look
    // moved: a rack left at gold still reads as gold.
    expect(dissolveHoldEnvelope(REST_BETA)).toBeCloseTo(1, 5)
    for (const tau of [0, 0.4, Math.PI / 2, 2.6, Math.PI]) {
      expect(dissolveShownTau(tau, REST_BETA)).toBeCloseTo(tau, 4)
    }
  })

  it('the closing book takes ANY held flip to flat, monotonically', () => {
    expect(dissolveHoldEnvelope(0)).toBeCloseTo(0, 12)
    let prev = -1
    for (let i = 0; i <= 60; i++) {
      const e = dissolveHoldEnvelope((Math.PI * i) / 60)
      expect(e).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = e
    }
    for (const tau of [0.4, Math.PI / 2, 2.6, Math.PI]) {
      expect(dissolveShownTau(tau, 0)).toBeCloseTo(0, 12)
    }
  })

  it('the closed book contains the strip for EVERY held flip (the old 0.14 overreach)', () => {
    // The snap used to leave a latched-gold rack drawn to tau = PI at book
    // close, and dissolveTabOut(PI) IS the stroke — 0.14 world past the trim,
    // which the containment law (A4) does not allow. Pulling the envelope toward
    // tau = 0 draws the strip back in with the tongue's own slack.
    for (const held of [0, 0.4, Math.PI / 2, 2.6, Math.PI]) {
      const shown = dissolveShownTau(held, 0)
      expect(dissolveTabOut(dissolve, shown)).toBeCloseTo(0, 9)
      for (const p of dissolveTabQuad(dissolve, shown, Math.PI, Math.PI)) {
        expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(PAGE_W + 1e-9)
      }
    }
  })

  it('the rack lies FLAT at book-closed whatever the reader left it at', () => {
    for (const held of [0.6, Math.PI / 2, 2.2]) {
      const pose = solveDissolvePose(dissolve, dissolveShownTau(held, 0), Math.PI, Math.PI)
      for (const slat of pose.slats) {
        // every slat corner is back in the page plane (lift = the rack's own
        // coplanar base lift, no standing rib inside a shut book)
        const lifts = slat.map((p) => Math.abs(p[0] * Math.sin(Math.PI) - p[1] * Math.cos(Math.PI)))
        for (const l of lifts) expect(l).toBeLessThan(0.02)
      }
    }
  })
})

describe('S5R2-4a — the rack turns about its own hinge, the tongue pulls as a strip', () => {
  it('the slat under the hand is the one that answers', () => {
    const pitch = (dissolve.d1 - dissolve.d0) / dissolve.slats
    for (let k = 0; k < dissolve.slats; k++) {
      expect(dissolveSlatAt(dissolve, dissolve.d0 + k * pitch + pitch * 0.2)).toBe(k)
    }
    // Off either end the nearest slat still answers rather than nothing.
    expect(dissolveSlatAt(dissolve, dissolve.d0 - 1)).toBe(0)
    expect(dissolveSlatAt(dissolve, dissolve.d1 + 1)).toBe(dissolve.slats - 1)
  })

  it('the hinge basis measures tau itself: a point ON the slat reads its flip', () => {
    for (const k of [0, 3, 5]) {
      const hinge = dissolveSlatHinge(dissolve, k, thetaL, thetaR)
      for (const tau of [0, 0.7, Math.PI / 2, 2.4, Math.PI]) {
        // The slat's own far edge, in world, relative to the hinge.
        const quad = solveDissolvePose(dissolve, tau, thetaL, thetaR).slats[k]
        const far: Vec3 = [
          (quad[2][0] + quad[3][0]) / 2 - hinge.center[0],
          (quad[2][1] + quad[3][1]) / 2 - hinge.center[1],
          (quad[2][2] + quad[3][2]) / 2 - hinge.center[2],
        ]
        const along = far[0] * hinge.e1[0] + far[1] * hinge.e1[1] + far[2] * hinge.e1[2]
        const up = far[0] * hinge.e2[0] + far[1] * hinge.e2[1] + far[2] * hinge.e2[2]
        expect(Math.atan2(up, along)).toBeCloseTo(tau, 6)
      }
    }
  })

  it('the gearing has NO centre singularity — the winch lesson, reused', () => {
    // Class B1's angle about the hinge goes as 1/r, and the swing radius here is
    // one slat pitch (~43 screen px), so a press a few px from the hinge line
    // would spin at 20 deg/px. crankTangentialDelta divides the hand's TANGENTIAL
    // travel by a FIXED reference radius instead, so the same stroke costs the
    // same angle wherever on the slat it started...
    const pitch = (dissolve.d1 - dissolve.d0) / dissolve.slats
    const step = pitch * 0.05
    const deltas = [0.1, 0.25, 0.5, 1, 1.5].map((f) => {
      const r = pitch * f
      return crankTangentialDelta({ angle: 0, r }, { angle: step / r, r }, pitch)
    })
    // (within 2% — the residue is chord-vs-arc at the tightest radius, not gain.)
    for (const d of deltas) expect(Math.abs(d / deltas[0] - 1)).toBeLessThan(0.02)
    // ...and pressing near the hinge turns the slat LESS, never more, which is
    // what pinching a real blind by its hinge does.
    const near = crankTangentialDelta({ angle: 0, r: pitch * 0.1 }, { angle: 0.5, r: pitch * 0.1 }, pitch)
    const rim = crankTangentialDelta({ angle: 0, r: pitch }, { angle: 0.5, r: pitch }, pitch)
    expect(Math.abs(near)).toBeLessThan(Math.abs(rim))
  })

  it('the hinge axis is well conditioned for the reading camera', () => {
    // Class B1 collapses when the view lies IN the swing plane (the s2 rank's
    // defect). The rack's hinges run along the spine, which points at the eye,
    // so the swing plane's normal and the view direction are nearly aligned —
    // the good case. Gate it rather than assume it.
    const hinge = dissolveSlatHinge(dissolve, 3, thetaL, thetaR)
    const c = toScreen(hinge.center)
    expect(c[0]).toBeGreaterThan(0)
    expect(c[0]).toBeLessThan(FRAME_W)
    const view: Vec3 = [0 - hinge.center[0], 1.85 - hinge.center[1], 3.05 - hinge.center[2]]
    const l = Math.hypot(view[0], view[1], view[2])
    const cos = Math.abs((view[0] * hinge.axis[0] + view[1] * hinge.axis[1] + view[2] * hinge.axis[2]) / l)
    expect(cos).toBeGreaterThan(0.5)
  })

  it('the tongue is still a strip: draw equals protrusion, exactly', () => {
    for (const tau of [0, 1, Math.PI]) {
      expect(dissolveTabOut(dissolve, tau)).toBeCloseTo((dissolveStroke(dissolve) * tau) / Math.PI, 12)
    }
  })
})

// ---------------------------------------------------------------------------
// S5R2-4b — THE GOLD PILE HAS A HOME AGAIN

describe('S5R2-4b — the mound clicks into the pose the scene ships in', () => {
  const stop = tabPieceStopLift(goldpile)
  const home = tabPieceRestLift(goldpile)

  it('home is the channel value that renders the page cam at EVERY dihedral', () => {
    for (const beta of [Math.PI, 2.4, 1.2, 0.3]) {
      expect(home * tabPieceCamShape(goldpile, beta)).toBeCloseTo(tabPieceLift(goldpile, beta), 12)
    }
  })

  it('home is a real interior station, not one of the ends', () => {
    expect(home).toBeGreaterThan(TABPIECE_DETENT * 2)
    expect(stop - home).toBeGreaterThan(TABPIECE_DETENT * 2)
  })

  it('a release inside the band latches the shipped silhouette EXACTLY', () => {
    for (const off of [-0.4, -0.2, 0, 0.2, 0.4].map((f) => f * TABPIECE_DETENT)) {
      expect(tabPieceDetent(goldpile, home + off)).toBeCloseTo(home, 9)
    }
    const latched = solveTabPiecePoseAt(goldpile, tabPieceDetent(goldpile, home + TABPIECE_DETENT * 0.3), thetaL, thetaR)
    const shipped = solveTabPiecePose(goldpile, thetaL, thetaR)
    latched.forEach((p, i) => {
      p.quad.forEach((c, j) => {
        for (let a = 0; a < 3; a++) expect(c[a]).toBeCloseTo(shipped[i].quad[j][a], 6)
      })
    })
  })

  it('flat and the mechanical stop click too', () => {
    expect(tabPieceDetent(goldpile, TABPIECE_DETENT * 0.3)).toBeCloseTo(0, 9)
    expect(tabPieceDetent(goldpile, stop - TABPIECE_DETENT * 0.3)).toBeCloseTo(stop, 9)
  })

  it('the detent is the identity between stations, and monotone throughout', () => {
    expect(tabPieceDetent(goldpile, (home + stop) / 2)).toBeCloseTo((home + stop) / 2, 9)
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const v = tabPieceDetent(goldpile, (stop * i) / 400)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
  })

  it('the home band is a reader-scale piece of hand, not a hair', () => {
    // The live probe measured 0.28 deg of lift per screen px at this piece's
    // gearing; the band has to be worth tens of px or nobody feels it, and must
    // stay well under the travel or the piece stops being analog.
    const bandPx = deg(TABPIECE_DETENT) / 0.28
    expect(bandPx).toBeGreaterThan(15)
    expect(deg(TABPIECE_DETENT) * 2).toBeLessThan(deg(stop) / 3)
  })
})

// ---------------------------------------------------------------------------
// S5R2-3 — THE CORNER YIELDS TO THE PAPER

const cornerRect = (dir: 'prev' | 'next'): ScreenBox => {
  const w = (CORNER_W_PCT / 100) * FRAME_W
  const h = (CORNER_H_PCT / 100) * FRAME_H
  const side = (CORNER_SIDE_PCT / 100) * FRAME_W
  const bottom = (CORNER_BOTTOM_PCT / 100) * FRAME_H
  const x0 = dir === 'prev' ? side : FRAME_W - side - w
  const y0 = FRAME_H - bottom - h
  return { x0, y0, x1: x0 + w, y1: y0 + h, w, h, area: w * h }
}

describe('S5R2-3 — the corner hotspots really do sit on both movers', () => {
  it('the left corner is inside the dissolve placard, not beside it', () => {
    const rect = cornerRect('prev')
    const placard = screenBox(solveDissolvePose(dissolve, 0, thetaL, thetaR).base)
    expect(boxesOverlap(rect, placard)).toBe(true)
    // ...and it is not a graze: the finding says "almost entirely on top of".
    const ox = Math.min(rect.x1, placard.x1) - Math.max(rect.x0, placard.x0)
    const oy = Math.min(rect.y1, placard.y1) - Math.max(rect.y0, placard.y0)
    expect((ox * oy) / rect.area).toBeGreaterThan(0.5)
  })

  it('the right corner is inside the gold pile', () => {
    const rect = cornerRect('next')
    const body = solveTabPiecePose(goldpile, thetaL, thetaR).filter((p) => p.face !== 'tab')
    expect(body.some((p) => boxesOverlap(rect, screenBox(p.quad)))).toBe(true)
  })
})

describe('S5R2-3 — one predicate answers the cue and the press', () => {
  const CENTRE = { x: cornerRect('prev').x0 + 40, y: cornerRect('prev').y0 + 36 }
  const claim = (over: Partial<{ hover: string | null; grab: string | null; overlay: boolean }>) => ({
    hover: null,
    grab: null,
    overlay: false,
    ...over,
  })

  it('a corner pixel with nothing on it still turns the page', () => {
    expect(cornerTurnFor(CENTRE.x, CENTRE.y, FRAME_W, FRAME_H, claim({}))).toBe('prev')
    expect(cornerTurnAt(CENTRE.x, CENTRE.y, FRAME_W, FRAME_H)).toBe('prev')
  })

  it('a live grabbable takes the pixel ENTIRELY — no dog-ear, no turn', () => {
    for (const c of [claim({ hover: 'ch4-dissolve' }), claim({ grab: 'ch4-goldpile' })]) {
      expect(sceneOwnsPointer(c)).toBe(true)
      expect(cornerTurnFor(CENTRE.x, CENTRE.y, FRAME_W, FRAME_H, c)).toBeNull()
    }
  })

  it('the HTML text layer takes it too — the leg that was missing', () => {
    // The press path always refused overlay pixels; the cue path lit the fold on
    // them, which is exactly "the dog-ear lights and clicking fires neither".
    const c = claim({ overlay: true })
    expect(sceneOwnsPointer(c)).toBe(true)
    expect(cornerTurnFor(CENTRE.x, CENTRE.y, FRAME_W, FRAME_H, c)).toBeNull()
  })

  it('yielding is about the pixel, not the corner: the other corner yields too', () => {
    const r = cornerRect('next')
    expect(cornerTurnFor(r.x0 + 40, r.y0 + 36, FRAME_W, FRAME_H, claim({}))).toBe('next')
    expect(cornerTurnFor(r.x0 + 40, r.y0 + 36, FRAME_W, FRAME_H, claim({ hover: 'ch4-goldpile' }))).toBeNull()
  })

  it('nothing off the two rects ever turns, claimed or not', () => {
    for (const p of [
      { x: 20, y: 20 },
      { x: FRAME_W / 2, y: FRAME_H - 40 },
      { x: 4, y: FRAME_H - 4 },
    ]) {
      expect(cornerTurnFor(p.x, p.y, FRAME_W, FRAME_H, claim({}))).toBeNull()
    }
  })
})
