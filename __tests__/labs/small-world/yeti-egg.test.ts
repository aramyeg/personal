import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EGG_THETA, EGG_X, peekPose } from '@/components/labs/small-world/scene/props/yeti-egg'
import { PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'

/**
 * Task 61 — the yeti easter egg's one-shot.
 *
 * The interesting properties of this feature are not its geometry, they are its EDGES: it must
 * start and end at exactly the resting pose, it must be impossible to leave half-deployed, and it
 * must never advance on its own. `peekPose` is a pure function of the one-shot's own `t` precisely
 * so those can be asserted without a renderer — the component keeps the clock, the curve keeps the
 * shape, and the split is what makes cancellation provable rather than eyeballed.
 */

const SRC = join(
  process.cwd(),
  'components/labs/small-world/scene/props/yeti-egg.tsx'
)

describe('the peek one-shot', () => {
  it('rests at both ends, so a peek can never leave the figure deployed', () => {
    // This is the T-pose-class guarantee. The pose at t = 0 and at t >= 1 is the SAME resting pose,
    // and every out-of-range t returns it too — which is what lets the frame loop cancel by simply
    // dropping the clock instead of unwinding an animation.
    for (const t of [-5, -0.001, 0, 1, 1.0001, 12]) {
      expect(peekPose(t), `t=${t}`).toEqual({ lean: 0, rise: 0, wave: 0 })
    }
  })

  it('leans fully out and comes fully back within the one-shot', () => {
    // ...and it has to actually GO somewhere in between, or the test above is vacuous.
    const peak = peekPose(0.5)
    expect(peak.lean).toBeCloseTo(1, 6)
    expect(peak.rise).toBeCloseTo(1, 6)
    // just before the end it is nearly home again
    expect(peekPose(0.99).lean).toBeLessThan(0.02)
  })

  it('moves monotonically out and then monotonically back, never jittering', () => {
    // A peek that wobbles on the way out reads as a glitch rather than a character. Sampled densely
    // enough to catch a non-monotonic easing rather than just its endpoints.
    let best = 0
    let bestAt = 0
    for (let i = 1; i < 200; i++) {
      const t = i / 200
      const v = peekPose(t).lean
      if (v > best) {
        best = v
        bestAt = t
      }
    }
    expect(best).toBeCloseTo(1, 6)
    for (let i = 1; i < 200; i++) {
      const t = i / 200
      const a = peekPose(t - 0.005).lean
      const b = peekPose(t).lean
      if (t <= bestAt) expect(b, `rising at ${t}`).toBeGreaterThanOrEqual(a - 1e-9)
      else expect(b, `falling at ${t}`).toBeLessThanOrEqual(a + 1e-9)
    }
  })

  it('waves only while it is out of cover', () => {
    // A wave that starts behind a tree is a wave nobody sees, and one that continues after the
    // figure has withdrawn is an arm flapping out of a trunk.
    expect(peekPose(0.05).wave).toBe(0)
    expect(peekPose(0.98).wave).toBe(0)
    let swung = 0
    for (let i = 0; i < 100; i++) {
      if (Math.abs(peekPose(0.25 + i * 0.0045).wave) > 0.3) swung++
    }
    expect(swung, 'the wave actually swings').toBeGreaterThan(10)
  })

  it('waves in BOTH directions, so it is a wave and not a lurch', () => {
    const vals = Array.from({ length: 200 }, (_, i) => peekPose(0.23 + i * 0.0025).wave)
    expect(Math.max(...vals)).toBeGreaterThan(0.5)
    expect(Math.min(...vals)).toBeLessThan(-0.5)
  })
})

describe('the egg house rules', () => {
  const src = readFileSync(SRC, 'utf8')

  it('never invents its own time — the only clock is the one the click starts', () => {
    // The lab's determinism contract: the scene is a pure function of scroll position, and the
    // single sanctioned exception is a USER-INITIATED one-shot. So the wall clock and the random
    // source are both banned outright here; the frame delta is the only time this file may see, and
    // it may only be accumulated once a click has set the clock running.
    expect(src).not.toMatch(/Date\.now|performance\.now|Math\.random/)
    expect(src).not.toMatch(/setInterval|setTimeout/)
    expect(src).not.toMatch(/console\./)
    expect(src).not.toMatch(/['"]#[0-9a-fA-F]{3,8}['"]/)
    // the clock starts at a click and nowhere else
    const starts = src.match(/clock\.current = 0/g) ?? []
    expect(starts.length, 'exactly one place starts the clock').toBe(1)
    expect(src).toMatch(/onClick[\s\S]{0,1400}clock\.current = 0/)
  })

  it('checks its own gate inside the click handler, not just in the render', () => {
    // "Not drawn" is not by itself "not clickable" — r3f's event layer walks its own interaction
    // list — so an invisible click trap in the middle of a scrolling page is a real risk. Both
    // pointer entries re-check the armed flag before doing anything.
    expect(src).toMatch(/onClick[\s\S]{0,900}if \(!armed\.current\) return/)
    expect(src).toMatch(/onPointerOver[\s\S]{0,300}if \(!armed\.current\) return/)
  })

  it('arms on BOTH the variant gate and the journey progress', () => {
    // Either alone arms a target the visitor cannot see: the variant gate is true while the ground
    // is round the back of the planet, and progress alone ignores which paint that ground carries.
    expect(src).toMatch(/activeVariantAt\([\s\S]{0,80}&&[\s\S]{0,120}progress >= EGG_FROM/)
  })

  it('cancels the one-shot when the gate closes, in the same frame', () => {
    expect(src).toMatch(/if \(!live\)[\s\S]{0,400}clock\.current = null/)
  })

  it('sets the pointer cursor imperatively, and always clears its own', () => {
    // A stranded `cursor: pointer` over dead canvas outlives the thing that promised it, so the
    // component tracks whether it currently OWNS the cursor and only ever clears its own.
    expect(src).toMatch(/document\.body\.style\.cursor = on \? 'pointer' : ''/)
    expect(src).toMatch(/owned\.current/)
    // Imperative rather than via React state: the state version needed a commit before the cursor
    // changed, so a pointer moved and sampled in the same tick still saw the old value — which is
    // what made the locating sweep in bench/task61-egg.mjs come back empty on a working hotspot.
    expect(src, 'no state round-trip for the cursor').not.toMatch(/setHover/)
    // and it is released on unmount
    expect(src).toMatch(/useEffect\(\(\) => \(\) => \{[\s\S]{0,160}cursor = ''/)
  })

  it('documents its accessibility choice rather than leaving it implicit', () => {
    // This is an easter egg inside an aria-hidden canvas and it is NOT keyboard reachable. That is
    // a decision, and a decision that is not written down reads as an oversight to the next author.
    expect(src).toMatch(/A11Y/)
    expect(src).toMatch(/reduced motion|REDUCED MOTION/i)
    expect(src).toMatch(/prefers-reduced-motion/)
  })
})

describe('where the egg hides', () => {
  /** Unit direction at latitude nx and longitude theta — `biomes.ts`'s own `place`. */
  const place = (nx: number, theta: number): [number, number, number] => {
    const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
    return [nx, ring * Math.cos(theta), ring * Math.sin(theta)]
  }
  const norm = (v: [number, number, number]): [number, number, number] => {
    const m = Math.hypot(v[0], v[1], v[2])
    return [v[0] / m, v[1] / m, v[2] / m]
  }
  const ang = (a: [number, number, number], b: [number, number, number]): number =>
    Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])))

  const egg = norm(place(EGG_X / PLANET_RADIUS, EGG_THETA))

  it('does not stand in the icy lake', () => {
    // THIS TEST EXISTS BECAUSE THE BUG SHIPPED PAST EVERY OTHER ONE. The winter wedge's only water
    // is the icy lake, and it is sacred: B2_FROZEN (r 0.14, feather 0.10) and B2_SHELF (r 0.28,
    // feather 0.13) in biomes.ts. The Forest's INSTANCED scatter rejects underwater candidates for
    // itself — which is a trap, because it means "there are conifers around here" is not evidence
    // that a HAND-PLACED prop is on dry land. A hand-placed one has no such check.
    //
    // The first shipped anchor sat 0.4016 rad from B2_SHELF's centre against a 0.410 limit: eight
    // thousandths inside the water, invisible to the whole suite, and found only because the lane
    // that owns the terrain warned about it. The numbers are duplicated here rather than imported
    // so that a change to the pond in biomes.ts fails this test instead of silently moving the
    // limit under it — the point is to be told when the two stop agreeing.
    // ↓↓ DO NOT REPLACE THESE WITH AN IMPORT. ↓↓
    //
    // They are duplicated ON PURPOSE, and the duplication IS the test. An imported constant makes
    // this file track a moved pond silently, which is precisely the failure mode where nobody finds
    // out the yeti is standing in water again. A duplicated one makes the disagreement itself the
    // failing assertion.
    //
    // These literals already exist in THREE places: `biomes.ts` (B2_FROZEN / B2_SHELF, the source of
    // truth), `water-clay.ts` (ICE_CAPS, which renders them), and here. Until now nothing asserted
    // that any two of them agreed — `water-clay.ts`'s copy was logged as a drift risk for exactly
    // that reason. `the three copies of the pond agree` below is that missing assertion, so this
    // block is now the tripwire for the whole set rather than a fourth thing to keep in step.
    const FROZEN = { nx: 0.34, theta: 5.55, radius: 0.14, feather: 0.1 }
    const SHELF = { nx: 0.6, theta: 5.72, radius: 0.28, feather: 0.13 }
    const capOf = (p: typeof FROZEN) => ({ c: norm(place(p.nx, p.theta)), limit: p.radius + p.feather })
    for (const [name, p] of [['B2_FROZEN', FROZEN], ['B2_SHELF', SHELF]] as const) {
      const cap = capOf(p)
      expect(ang(egg, cap.c), `clear of ${name}`).toBeGreaterThan(cap.limit + 0.03)
    }
  })

  it('the three copies of the pond agree', () => {
    // The assertion `water-clay.ts`'s duplicate was missing. If someone moves a pond in biomes.ts,
    // this fails and names the file that did not follow — instead of the ice quietly rendering in
    // the wrong place and the egg quietly standing in water.
    //
    // Matched on collapsed-whitespace SUBSTRINGS rather than regexes: the thing being pinned is a
    // handful of literals, and a pattern with escapes in it is one more thing that can silently
    // stop matching what it names.
    const squash = (s: string): string => s.replace(/\s+/g, ' ')
    const read = (f: string): string =>
      squash(readFileSync(join(process.cwd(), 'components/labs/small-world/scene', f), 'utf8'))
    const biomes = read('biomes.ts')
    const water = read('water-clay.ts')
    for (const [name, nx, theta, radius, feather] of [
      ['B2_FROZEN', 0.34, 5.55, 0.14, 0.1],
      ['B2_SHELF', 0.6, 5.72, 0.28, 0.13],
    ] as const) {
      expect(
        biomes,
        `${name} moved in biomes.ts — update this test AND water-clay.ts's ICE_CAPS`
      ).toContain(`const ${name}: WaterBody = { dir: norm3(place(${nx}, ${theta})), radius: ${radius}, feather: ${feather},`)
      expect(
        water,
        `water-clay.ts ICE_CAPS no longer matches ${name} in biomes.ts`
      ).toContain(`{ dir: iceDir(${nx}, ${theta}), radius: ${radius}, feather: ${feather} }`)
    }
  })

  it('stays in the winter wood, which is the whole point of hiding there', () => {
    // ...and the other half of the vice: pushed clear of the water it must not end up standing in
    // open snow. SNOW_CAP is Forest's own conifer scatter (radius 0.55, feather 0.16).
    const cap = norm([0.5, Math.cos(5.55) * 0.866, Math.sin(5.55) * 0.866])
    expect(ang(egg, cap), 'within the conifer cap').toBeLessThan(0.55 + 0.16)
  })

  it('is on the hemisphere facing the camera at the winter dwell', () => {
    // Rotation is clamped at 4pi through the dwell, so the planet's local frame is unrotated there
    // and the anchor's own camera distance is the whole test. The centre plane is at 12.1; anything
    // beyond it is behind the horizon, which is exactly how the first anchor was lost.
    const DIST = 12.1
    const PITCH = (20 * Math.PI) / 180
    const cam = [0, DIST * Math.sin(PITCH), DIST * Math.cos(PITCH)]
    const p = egg.map((c) => c * PLANET_RADIUS)
    const camDist = Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2])
    expect(camDist, 'in front of the planet centre plane').toBeLessThan(12.0)
  })
})
