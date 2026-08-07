import { describe, expect, it } from 'vitest'
import {
  INK_PLACEMENT,
  INK_PLACEMENTS,
  INK_PRELOAD_T,
  INK_OPACITY_SHARE,
  INK_CLEAR_MARGIN,
  INK_EDGE_INSET,
  INK_HELD_MAX,
  INK_HELD_MIN,
  inkArrivalAt,
  inkCoversWorld,
  worldSilhouetteLeft,
} from '@/components/labs/small-world/overlay/ink-arrival'
import {
  GIRL_TRANSFER,
  GIRL_WALK_END,
} from '@/components/labs/small-world/scene/girl-exit'
import { EPILOGUE } from '@/components/labs/small-world/manga'

/**
 * THE INK ARRIVAL (Task 76, phase 1) — she leaves the world in three dimensions
 * and comes back as a drawing.
 *
 * Two obligations, and the second is the one the captures forced. It must be a
 * pure function of scroll like everything else in this ending; and it must not
 * land on top of the CREST WALK, which is the beat this round exists to protect.
 */

const LAND = 1440 / 900
const PHONE = 390 / 844
const at = (t: number) => inkArrivalAt(t, false, LAND)

describe('the page is a function of scroll and nothing else', () => {
  it('is not on screen for the whole journey or the first of the ending', () => {
    for (let i = 0; i <= 1000; i++) {
      const t = (i / 1000) * INK_PLACEMENT.inFrom
      expect(at(t).shown).toBe(false)
    }
  })

  it('returns the SHARED frozen hidden state, so nothing allocates while it is away', () => {
    const a = at(0)
    const b = at(INK_PLACEMENT.inFrom * 0.5)
    expect(a).toBe(b)
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('scrubs backwards bit-identically', () => {
    const forward: ReturnType<typeof at>[] = []
    for (let i = 0; i <= 2000; i++) forward.push(at(i / 2000))
    for (let i = 2000; i >= 0; i--) {
      const back = at(i / 2000)
      for (const k of ['present', 'lift', 'scale', 'height', 'x', 'y', 'tilt'] as const) {
        expect(Object.is(back[k], forward[i][k])).toBe(true)
      }
      expect(back.shown).toBe(forward[i].shown)
    }
  })

  it('arrives fully, and never over-arrives', () => {
    for (let i = 0; i <= 2000; i++) {
      const s = at(i / 2000)
      expect(s.present).toBeGreaterThanOrEqual(0)
      expect(s.present).toBeLessThanOrEqual(1)
    }
    expect(at(INK_PLACEMENT.inTo).present).toBeCloseTo(1, 9)
  })
})

describe('the page does not land on the crest walk', () => {
  it('is not drawn at any point while she is still leaving the world', () => {
    // The whole reason `spread` was rejected: it covered her exit with a
    // full-frame page. This is the gate that stops that happening by accident.
    for (let i = 0; i <= 1000; i++) {
      const t = (i / 1000) * GIRL_WALK_END
      expect(at(t).shown, `ink visible at t=${t.toFixed(3)}, during the exit`).toBe(false)
    }
  })

  it('waits for the transfer, not merely for the walk to end', () => {
    expect(INK_PLACEMENT.inFrom).toBeGreaterThanOrEqual(GIRL_WALK_END)
    expect(INK_PLACEMENT.inFrom).toBeLessThan(GIRL_TRANSFER + 0.1)
  })
})

describe('the page settles into the room rather than sitting on it', () => {
  it('is held large before the desk arrives and small once it has', () => {
    const held = at(0.5)
    const hung = at(1)
    expect(held.height).toBeGreaterThan(hung.height * 1.5)
    // It is held BESIDE the world, not on it (see INK_CLEAR_MARGIN), so both poses
    // live in the frame's left band and the travel is short.
    expect(held.x).toBeLessThan(0.35)
    expect(hung.x).toBeLessThan(0.35)
  })

  it('is still on screen at the money shot — it is a fixture, not a flash', () => {
    expect(at(1).shown).toBe(true)
    expect(at(1).present).toBeCloseTo(1, 9)
  })

  it('reaches its settled pose EXACTLY, so the money shot is a landed frame', () => {
    const settle = INK_PLACEMENT.settle!
    const s = at(settle.to)
    expect(Object.is(s.height, settle.pose.height)).toBe(true)
    expect(Object.is(s.y, settle.pose.at[1])).toBe(true)
    // x is DERIVED now, not authored: the settled page hangs on the same left
    // inset the held one did, so the two share an edge and the travel keeps it.
    const settledW = (settle.pose.height * (1024 / 1536)) / LAND
    expect(Object.is(s.x, INK_EDGE_INSET + settledW / 2)).toBe(true)
  })
})

describe('reduced motion still gets the beat, without the movement', () => {
  it('fades the page in and out and never travels or scales it', () => {
    for (let i = 0; i <= 500; i++) {
      const s = inkArrivalAt(i / 500, true, LAND)
      if (!s.shown) continue
      expect(Object.is(s.lift, 0)).toBe(true)
      expect(Object.is(s.scale, 1)).toBe(true)
    }
    expect(inkArrivalAt(1, true, LAND).shown).toBe(true)
  })
})

describe('the page it mounts is the one the manga lane prepared', () => {
  it('is the silent epilogue, unaltered', () => {
    expect(EPILOGUE.id).toBe('epilogue')
    expect(EPILOGUE.balloons).toHaveLength(0)
    expect(EPILOGUE.captions).toHaveLength(0)
    expect(EPILOGUE.panels).toHaveLength(1)
  })

  it('mounts the art before it is wanted, so it is decoded when it arrives', () => {
    expect(INK_PRELOAD_T).toBeLessThan(INK_PLACEMENT.inFrom)
    expect(INK_PRELOAD_T).toBeGreaterThan(0)
  })

  it('names one placement out of the candidates', () => {
    expect(INK_PLACEMENTS.map((p) => p.id)).toContain(INK_PLACEMENT.id)
  })
})

/**
 * THE PAGE MUST NEVER BE SEEN THROUGH (orchestrator's check, and it was real).
 *
 * The page is a DOM overlay, so the canvas cannot occlude it: at any partial
 * opacity it is an X-ray. A capture caught it at ~6% showing her face THROUGH the
 * planet's snow on the phone. The fix is that paper moves rather than fades — the
 * opacity is spent while `rise` still holds the page below the frame — and these
 * are the assertions that keep it fixed.
 */
describe('the page is never translucent over the scene', () => {
  /** The page's TOP edge, in fractions of viewport height, at a given lift.
   *  `height` is a fraction of the SHORTER axis, so the two reference viewports
   *  are the two cases: on a laptop the short axis IS the height, on a phone it
   *  is the width and the page is proportionally shorter. */
  const topEdge = (h: number, y: number, lift: number, w: number, vh: number) =>
    y - (h * Math.min(w, vh)) / vh / 2 + lift

  it('is fully opaque before ANY of it crosses the bottom edge, at both aspects', () => {
    let firstOpaque = -1
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000
      const s = at(t)
      if (s.shown && s.present >= 0.999) {
        firstOpaque = t
        break
      }
    }
    expect(firstOpaque).toBeGreaterThan(0)
    const s = at(firstOpaque)
    for (const [w, vh] of [
      [1440, 900],
      [390, 844],
      [360, 800],
    ]) {
      expect(
        topEdge(s.height, s.y, s.lift, w, vh),
        `page already in frame at ${w}x${vh} while still fading`
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('never draws a partially transparent page over anything in frame', () => {
    for (let i = 0; i <= 4000; i++) {
      const s = at(i / 4000)
      if (!s.shown || s.present >= 0.999) continue
      // Anything not fully opaque must still be entirely below the frame.
      for (const [w, vh] of [
        [1440, 900],
        [390, 844],
      ]) {
        expect(topEdge(s.height, s.y, s.lift, w, vh)).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('starts far enough below to clear the frame at the widest and narrowest', () => {
    // 0.85 of viewport height is what a laptop needs, 0.68 a phone. One number
    // covers both, and the gate is what stops it being trimmed to "looks fine".
    expect(INK_PLACEMENT.rise).toBeGreaterThanOrEqual(0.85)
  })
})

describe('portrait keeps the beat and clears its own money shot', () => {
  const port = (t: number) => inkArrivalAt(t, false, PHONE)

  it('holds the page up on a phone, exactly as it does on a laptop', () => {
    expect(port(0.5).shown).toBe(true)
    expect(port(0.5).present).toBeCloseTo(1, 6)
    expect(port(0.5).height).toBeCloseTo(INK_PLACEMENT.pose.height, 9)
  })

  it('then LEAVES, so the phone money shot has no page on the globe', () => {
    expect(port(1).shown).toBe(false)
    expect(port(0.9).shown).toBe(false)
  })

  it('never settles on portrait — a phone frame has no wall to hang it on', () => {
    for (let i = 0; i <= 1000; i++) {
      const s = port(i / 1000)
      if (!s.shown) continue
      expect(s.height).toBeCloseTo(INK_PLACEMENT.pose.height, 9)
      expect(s.x).toBeCloseTo(INK_PLACEMENT.pose.at[0], 9)
    }
  })

  it('leaves the LANDSCAPE composition completely alone', () => {
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000
      const a = inkArrivalAt(t, false, LAND)
      const b = at(t)
      for (const k of ['present', 'lift', 'scale', 'height', 'x', 'y', 'tilt'] as const) {
        expect(Object.is(a[k], b[k])).toBe(true)
      }
    }
  })

  it('scrubs backwards bit-identically on portrait too', () => {
    const forward: ReturnType<typeof port>[] = []
    for (let i = 0; i <= 1500; i++) forward.push(port(i / 1500))
    for (let i = 1500; i >= 0; i--) {
      const back = port(i / 1500)
      for (const k of ['present', 'lift', 'scale', 'height', 'x', 'y', 'tilt'] as const) {
        expect(Object.is(back[k], forward[i][k])).toBe(true)
      }
    }
  })
})

/**
 * THE PAGE MAY NOT STAND ON THE WORLD (blind-audit fix, and the gate that keeps it).
 *
 * The audit caught the held page intersecting the globe and its cradle — the ring
 * crossing its lower third, its right edge lost against the sphere. The earlier
 * gate did not catch it because it was written for a DIFFERENT failure class (a
 * partially TRANSPARENT page). This one is about an opaque page's BOX.
 *
 * The invariant is the simplest one that admits the beat: the page is either
 * entirely clear of the globe-plus-cradle box, or — on portrait, where there is no
 * gap beside the globe at all — it covers it outright. Standing half-on is the
 * failure.
 */
describe('the page never stands half-on the world', () => {
  const PAGE_AR = 1024 / 1536

  const box = (t: number, aspect: number) => {
    const s = inkArrivalAt(t, false, aspect)
    if (!s.shown) return null
    const halfW = (s.height * PAGE_AR) / aspect / 2
    const halfH = (s.height * (aspect >= 1 ? 1 : aspect)) / 2
    return { l: s.x - halfW, r: s.x + halfW, t: s.y + s.lift - halfH, b: s.y + s.lift + halfH }
  }

  it('clears the globe and the cradle at every landscape aspect, at every t', () => {
    for (const aspect of [1.0, 1.25, 1.6, 16 / 9, 2.0, 2.4, 3.5]) {
      // A frame with no room beside the globe COVERS it instead — the other legal
      // answer, checked separately below.
      if (inkCoversWorld(INK_PLACEMENT, aspect)) continue
      for (let i = 0; i <= 400; i++) {
        const t = i / 400
        const p = box(t, aspect)
        if (!p) continue
        const left = worldSilhouetteLeft(t, aspect)
        expect(
          p.r,
          `page overlaps the world at aspect ${aspect}, t=${t.toFixed(3)}`
        ).toBeLessThanOrEqual(left - INK_CLEAR_MARGIN + 1e-9)
      }
    }
  })

  it('stays inside the frame while it does it', () => {
    for (const aspect of [1.6, 16 / 9, 3.5]) {
      for (let i = 0; i <= 300; i++) {
        const p = box(i / 300, aspect)
        if (!p) continue
        expect(p.l).toBeGreaterThanOrEqual(INK_EDGE_INSET - 1e-9)
        expect(p.r).toBeLessThanOrEqual(1)
      }
    }
  })

  it('takes what the aspect actually offers — bigger where there is room', () => {
    // The gap scales with 1/aspect, so a wide monitor gets a bigger page and a
    // nearly-square window a smaller one. One authored number could only be right
    // at one of them.
    const wide = inkArrivalAt(0.5, false, 2.4).height
    const narrow = inkArrivalAt(0.5, false, 1.45).height
    expect(wide).toBeGreaterThan(narrow)
    expect(wide).toBeLessThanOrEqual(INK_HELD_MAX)
    expect(narrow).toBeGreaterThanOrEqual(INK_HELD_MIN)
    // ...and below the threshold it stops trying and covers the world instead.
    expect(inkCoversWorld(INK_PLACEMENT, 1.0)).toBe(true)
    expect(inkCoversWorld(INK_PLACEMENT, 1.6)).toBe(false)
  })

  it('PORTRAIT covers the world instead, which is the other legal answer', () => {
    // A phone has no gap beside the globe, so the page is held centred and covers
    // it outright, then leaves. Covering is not the failure; standing half-on is.
    const s = inkArrivalAt(0.5, false, PHONE)
    expect(s.shown).toBe(true)
    expect(Math.abs(s.x - 0.5)).toBeLessThan(0.02)
    expect(inkArrivalAt(1, false, PHONE).shown).toBe(false)
  })
})
