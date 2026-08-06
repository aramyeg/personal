import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  STEAM_BIRTH_R,
  STEAM_DEATH_R,
  STEAM_DRIFT,
  STEAM_DRIFT_Z,
  STEAM_LIFE,
  STEAM_PUFFS,
  STEAM_RATE_SPREAD,
  STEAM_RISE,
  STEAM_STILL_T,
  STEAM_STRETCH,
  readCoffeeAnchor,
  steamBoundsCenterY,
  steamBoundsRadius,
  steamClockAt,
  steamGateFor,
  steamPuffSeeds,
} from '@/components/labs/small-world/scene/props/desk-steam-field'
import { COFFEE_ANCHOR, DESK_GLB_URL } from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { studioLightsFor } from '@/components/labs/small-world/scene/desk-studio'
import {
  ENDING_IDLE,
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'

/**
 * THE COFFEE STEAM (Task 72), held to the ending's two standing obligations and to one new one.
 *
 * The two it inherits are the same ones `desk-studio.test.ts` gates for the studio lights: the plume
 * must be exactly nothing until the ending is under way, and it must be bit-identical scrubbed
 * backwards. Neither is asserted approximately — `Object.is` throughout, because "close to
 * invisible" is what a thing that has quietly started rendering looks like.
 *
 * The new one is the price of this being the ending's first wall clock (see `desk-steam.tsx`). The
 * clock is not merely unused during the journey; it does not RUN during the journey, and that is a
 * property of a pure function rather than of the frame loop being careful, so it is gated here.
 */

describe('the steam is exactly off until the ending is under way', () => {
  it('is a hard +0 across the whole journey and the whole still beat', () => {
    for (let i = 0; i <= 4000; i++) {
      const progress = (i / 4000) * ZOOM_FIRST_MOVE
      expect(Object.is(steamGateFor(endingStateAt(progress)), 0)).toBe(true)
    }
  })

  it('is +0 for the shared idle state every journey frame reads', () => {
    expect(Object.is(steamGateFor(ENDING_IDLE), 0)).toBe(true)
  })

  it('is exactly full at the money shot, so the last frame is a settled one', () => {
    expect(steamGateFor(endingStateAt(TRACK_END))).toBe(1)
  })

  it('is the studio lights and nothing else — one clock, not a second curve', () => {
    // The whole argument for keying the ending on `zoom` applies to what rises off the desk's mug at
    // least as strongly as it applies to the desk. Any shaping here would be a second curve.
    for (let i = 0; i <= 2000; i++) {
      const e = endingStateAt((i / 2000) * TRACK_END)
      expect(steamGateFor(e)).toBe(studioLightsFor(e))
    }
  })
})

describe('the envelope is a pure function of scroll, forwards and backwards', () => {
  it('gives bit-identical values scrubbing back through the same positions', () => {
    const up: number[] = []
    for (let i = 0; i <= 3000; i++) up.push(steamGateFor(endingStateAt((i / 3000) * TRACK_END)))
    for (let i = 3000; i >= 0; i--) {
      expect(Object.is(steamGateFor(endingStateAt((i / 3000) * TRACK_END)), up[i])).toBe(true)
    }
  })

  it('never goes backwards on the way up', () => {
    let prev = -1
    for (let i = 0; i <= 3000; i++) {
      const v = steamGateFor(endingStateAt((i / 3000) * TRACK_END))
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('the clock does not run outside the ending', () => {
  it('returns the accumulator UNCHANGED while the gate is shut', () => {
    for (const prev of [0, 1.83, 12.5, 9999]) {
      for (const delta of [0, 1 / 60, 1 / 30, 0.5, 8]) {
        expect(Object.is(steamClockAt(prev, delta, 0, false), prev)).toBe(true)
      }
    }
  })

  it('does not advance across a whole journey of frames at 60 fps', () => {
    // The claim `desk-steam.tsx` makes is that a visitor who scrolls to the ending after ten minutes
    // and one who gets there in ten seconds see the plume from the same instant of its own life.
    // This is that sentence: ten minutes of frames over the journey domain, and nothing moves.
    let t = 0
    for (let i = 0; i <= 36000; i++) {
      const gate = steamGateFor(endingStateAt((i / 36000) * ZOOM_FIRST_MOVE))
      t = steamClockAt(t, 1 / 60, gate, false)
    }
    expect(Object.is(t, 0)).toBe(true)
  })

  it('advances by exactly the frame delta once the gate is open', () => {
    let t = 0
    for (let i = 0; i < 600; i++) t = steamClockAt(t, 1 / 60, 1, false)
    expect(t).toBeCloseTo(10, 9)
  })

  it('takes `delta` rather than a wall clock, so a backgrounded tab cannot jump the plume', () => {
    // r3f hands a paused tab a delta of very nearly zero; a wall clock would hand it however long
    // the visitor was away, which is the one way this could produce an event the eye catches.
    expect(steamClockAt(4, 0, 1, false)).toBe(4)
  })
})

describe('reduced motion takes the motion out, not the steam', () => {
  it('pins the clock to one instant whatever the gate and the delta say', () => {
    for (const prev of [0, 1.83, 250]) {
      for (const delta of [0, 1 / 60, 3]) {
        for (const gate of [0, 0.5, 1]) {
          expect(steamClockAt(prev, delta, gate, true)).toBe(STEAM_STILL_T)
        }
      }
    }
  })

  it('never drifts, however many frames run', () => {
    let t = 0
    for (let i = 0; i < 10000; i++) t = steamClockAt(t, 1 / 60, 1, true)
    expect(Object.is(t, STEAM_STILL_T)).toBe(true)
  })

  it('leaves the plume VISIBLE — the preference removes movement, not an object', () => {
    // The choice was a still plume or no plume, and it went to the still one: deleting it under the
    // preference does not remove motion from a picture, it removes the thing that says the coffee
    // beside the note is hot. So the envelope is untouched by the preference by construction —
    // `steamGateFor` cannot see it — and the frozen instant is inside a puff's life rather than at
    // its ends, where the column would be half empty.
    expect(STEAM_STILL_T).toBeGreaterThan(0)
    expect(STEAM_STILL_T).toBeLessThan(STEAM_LIFE)
  })
})

describe('the anchor is READ FROM THE ASSET, not typed in', () => {
  const build = (pos: [number, number, number], r: number, nest = false) => {
    const root = new THREE.Object3D()
    const anchor = new THREE.Object3D()
    anchor.name = COFFEE_ANCHOR
    anchor.position.set(...pos)
    anchor.scale.setScalar(r)
    if (nest) {
      const mid = new THREE.Object3D()
      mid.position.set(1, 2, 3)
      mid.scale.setScalar(2)
      mid.add(anchor)
      root.add(mid)
    } else {
      root.add(anchor)
    }
    return root
  }

  it('returns whatever the node says, for two different nodes', () => {
    // The point of the whole test: the answer is a FUNCTION of the tree. A hardcoded plume would
    // return the same thing for both of these and pass every other test in this file.
    const a = readCoffeeAnchor(build([-2.595, 1.894, 11.3], 0.2995))!
    const b = readCoffeeAnchor(build([7, -1, 0.5], 1.75))!
    expect([a.x, a.y, a.z]).toEqual([-2.595, 1.894, 11.3])
    expect(a.radius).toBeCloseTo(0.2995, 6)
    expect([b.x, b.y, b.z]).toEqual([7, -1, 0.5])
    expect(b.radius).toBeCloseTo(1.75, 6)
  })

  it('accumulates ancestors up to but NOT INCLUDING the root', () => {
    // `desk-glb.tsx` reparents its meshes out of the glTF scene with `<primitive>`, which drops the
    // root's own transform. The steam has to land in the same frame or a root transform would move
    // one and not the other.
    const root = build([1, 1, 1], 0.5, true)
    root.position.set(100, 100, 100)
    root.scale.setScalar(10)
    const a = readCoffeeAnchor(root)!
    // through the mid node (translate 1,2,3 then scale 2) and nothing from the root
    expect([a.x, a.y, a.z]).toEqual([3, 4, 5])
    expect(a.radius).toBeCloseTo(1, 6)
  })

  it('degrades to NO STEAM rather than throwing, for a missing or degenerate anchor', () => {
    // The desk loads through its own manager and can fail forever; an asset without the node is a
    // re-bake this component has no business guessing around. Both are null, never an exception.
    expect(readCoffeeAnchor(new THREE.Object3D())).toBeNull()
    expect(readCoffeeAnchor(build([0, 0, 0], 0))).toBeNull()
  })

  it('finds the anchor the SHIPPED asset actually carries, at the size it carries', () => {
    // Read straight out of the GLB's JSON chunk, independently of the runtime loader, and fed
    // through the same function the renderer uses. If T71's node were ever dropped or renamed, this
    // fails here rather than shipping a mug that has silently stopped steaming.
    const node = shippedAnchorNode()
    const a = readCoffeeAnchor(build(node.translation as [number, number, number], node.scale[0]))!
    expect(a.radius).toBeGreaterThan(0.05)
    expect(a.y).toBeGreaterThan(0)
  })

  it('has no coordinate of the shipped anchor written anywhere in the steam sources', () => {
    // The structural half of the claim. `readCoffeeAnchor` being a function of its input proves it
    // CAN read the asset; this proves nothing shipped alongside it quietly hardcodes the answer.
    const node = shippedAnchorNode()
    const src = [
      'components/labs/small-world/scene/props/desk-steam.tsx',
      'components/labs/small-world/scene/props/desk-steam-field.ts',
    ]
      .map((p) => readFileSync(path.join(process.cwd(), p), 'utf8'))
      .join('\n')
    for (const v of [...node.translation, node.scale[0]]) {
      // four significant figures is enough to catch a paste and loose enough not to trip on an
      // unrelated constant that happens to share a leading digit
      const needle = Math.abs(v).toFixed(3)
      expect(src, `hardcoded ${needle}`).not.toContain(needle)
    }
  })
})

describe('the puff seeds are deterministic and evenly spread', () => {
  it('gives the same puffs on every call', () => {
    expect(Array.from(steamPuffSeeds())).toEqual(Array.from(steamPuffSeeds()))
    expect(steamPuffSeeds()).toHaveLength(STEAM_PUFFS * 4)
  })

  it('populates the column evenly — no two puffs share a phase, and no gap is twice the mean', () => {
    // The whole reason the phases come off an additive golden-ratio recurrence rather than a hash:
    // a hash can leave a hole in the cycle, and because the plume loops, that hole is there every
    // 3.6 s forever. Low discrepancy is the property being bought, so it is the property gated.
    const phases = [...Array(STEAM_PUFFS)].map((_, i) => steamPuffSeeds()[i * 4]).sort((a, b) => a - b)
    expect(new Set(phases).size).toBe(STEAM_PUFFS)
    const gaps = phases.map((p, i) => (i === 0 ? p + 1 - phases[phases.length - 1] : p - phases[i - 1]))
    const mean = 1 / STEAM_PUFFS
    expect(Math.max(...gaps), `gaps ${gaps.map((g) => g.toFixed(4))}`).toBeLessThan(mean * 2)
    expect(Math.min(...gaps)).toBeGreaterThan(0)
  })

  it('keeps every rate positive and inside the published spread', () => {
    // A non-positive rate is a puff frozen at its birth phase forever — a bright dot on the coffee.
    const s = steamPuffSeeds()
    for (let i = 0; i < STEAM_PUFFS; i++) {
      const rate = s[i * 4 + 1]
      expect(rate).toBeGreaterThan(0)
      expect(Math.abs(rate * STEAM_LIFE - 1)).toBeLessThanOrEqual(STEAM_RATE_SPREAD / 2 + 1e-9)
    }
  })

  it('does not correlate a puff’s speed with its lean', () => {
    // Four channels off four different irrationals. Sharing one would make the plume a pattern,
    // however irrational the increment.
    const s = steamPuffSeeds()
    const rate: number[] = []
    const swirl: number[] = []
    for (let i = 0; i < STEAM_PUFFS; i++) {
      rate.push(s[i * 4 + 1])
      swirl.push(s[i * 4 + 2])
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
    const mr = mean(rate)
    const ms = mean(swirl)
    const cov = rate.reduce((acc, r, i) => acc + (r - mr) * (swirl[i] - ms), 0)
    const sr = Math.sqrt(rate.reduce((a, r) => a + (r - mr) ** 2, 0))
    const ss = Math.sqrt(swirl.reduce((a, w) => a + (w - ms) ** 2, 0))
    expect(Math.abs(cov / (sr * ss))).toBeLessThan(0.5)
  })
})

describe('the declared bounding sphere really contains the plume', () => {
  it('holds every puff at every phase, so nothing culls a plume that is on screen', () => {
    // The quads are expanded in VIEW space, which is what makes them billboards and also what makes
    // their extent invisible to any bounds three could derive from the buffer. The sphere is
    // therefore asserted rather than computed, and this re-derives the assertion from the same
    // constants the vertex shader is built from.
    const s = steamPuffSeeds()
    const R = steamBoundsRadius()
    let worst = 0
    for (let i = 0; i < STEAM_PUFFS; i++) {
      const swirl = s[i * 4 + 2]
      const wobble = s[i * 4 + 3]
      for (let k = 0; k <= 200; k++) {
        const p = k / 200
        const wander = p * STEAM_DRIFT
        const cx = Math.sin(swirl + p * wobble) * wander
        const cy = p * STEAM_RISE
        const cz = Math.cos(swirl * 1.61 + p * wobble * 0.77) * wander * STEAM_DRIFT_Z
        const grow = STEAM_BIRTH_R + (STEAM_DEATH_R - STEAM_BIRTH_R) * p
        const reach = Math.hypot(cx, cy - steamBoundsCenterY(), cz) + grow * Math.max(1, STEAM_STRETCH)
        worst = Math.max(worst, reach)
      }
    }
    expect(worst, `worst reach ${worst.toFixed(4)} vs sphere ${R.toFixed(4)}`).toBeLessThanOrEqual(R)
  })
})

/** The `CoffeeAnchor` node as the shipped GLB's JSON chunk actually holds it. Deliberately a local
 *  reader rather than the runtime loader — the point is to read the bytes independently. */
function shippedAnchorNode(): { translation: number[]; scale: number[] } {
  const buf = readFileSync(path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, '')))
  let off = 12
  let json: { nodes: { name: string; translation?: number[]; scale?: number[] }[] } | null = null
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const kind = buf.readUInt32LE(off + 4)
    if (kind === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'))
    off += 8 + len + ((4 - (len % 4)) % 4)
  }
  const node = json?.nodes.find((n) => n.name === COFFEE_ANCHOR)
  if (!node?.translation || !node.scale) throw new Error(`${COFFEE_ANCHOR} missing from the shipped GLB`)
  return { translation: node.translation, scale: node.scale }
}
