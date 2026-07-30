import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { peekPose } from '@/components/labs/small-world/scene/props/yeti-egg'

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
