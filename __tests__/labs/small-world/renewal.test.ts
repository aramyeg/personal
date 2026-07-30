import { describe, expect, it } from 'vitest'
import {
  STANCE_ALPHA,
  FLIP_START,
  FLIP_WIDTH,
  canonicalTheta,
  renewalGate,
  activeVariantAt,
  EPILOGUE_START,
  EPILOGUE_WIDTH,
  EPILOGUE_END,
  epilogueGate,
  sceneVariantAt,
} from '@/components/labs/small-world/scene/renewal'

const TWO_PI = Math.PI * 2

describe('canonicalTheta', () => {
  it('maps any angle into [STANCE_ALPHA, STANCE_ALPHA + 2π)', () => {
    for (let a = -20; a <= 20; a += 0.37) {
      const t = canonicalTheta(a)
      expect(t).toBeGreaterThanOrEqual(STANCE_ALPHA)
      expect(t).toBeLessThan(STANCE_ALPHA + TWO_PI)
    }
  })

  it('is 2π-consistent (invariant under ±2π shifts of the input)', () => {
    for (const a of [0, 1.2, 3.9, -0.8, 5.5, Math.PI]) {
      expect(canonicalTheta(a)).toBeCloseTo(canonicalTheta(a + TWO_PI), 10)
      expect(canonicalTheta(a)).toBeCloseTo(canonicalTheta(a - TWO_PI), 10)
    }
  })

  it('handles atan2 quadrants — a local direction round-trips to its ring angle', () => {
    // atan2(nz, ny) recovers the ring angle (mod 2π); canonicalTheta re-wraps it.
    for (const theta of [0.5, 1.9, 3.3, 4.8, 6.0]) {
      const ny = Math.cos(theta)
      const nz = Math.sin(theta)
      expect(canonicalTheta(Math.atan2(nz, ny))).toBeCloseTo(canonicalTheta(theta), 10)
    }
  })

  it('places the wrap seam exactly at the stance meridian', () => {
    expect(canonicalTheta(STANCE_ALPHA)).toBeCloseTo(STANCE_ALPHA, 10)
    // just below the seam wraps up by a full turn
    expect(canonicalTheta(STANCE_ALPHA - 1e-6)).toBeCloseTo(STANCE_ALPHA - 1e-6 + TWO_PI, 6)
  })
})

describe('renewalGate', () => {
  it('is exactly 0 before the flip window (rotation − thetaC < FLIP_START)', () => {
    expect(renewalGate(1.0, 1.0 + FLIP_START - 0.01)).toBe(0)
    expect(renewalGate(2.0, 2.0)).toBe(0)
  })

  it('is exactly 1 after the flip window (rotation − thetaC > FLIP_START + FLIP_WIDTH)', () => {
    expect(renewalGate(1.0, 1.0 + FLIP_START + FLIP_WIDTH + 0.01)).toBe(1)
    expect(renewalGate(1.0, 1.0 + 5)).toBe(1)
  })

  it('rises monotonically across the window, hitting 0.5 at its centre', () => {
    const thetaC = 1.0
    let prev = -1
    for (let r = thetaC; r <= thetaC + FLIP_START + FLIP_WIDTH + 1; r += 0.01) {
      const g = renewalGate(thetaC, r)
      expect(g).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = g
    }
    const mid = thetaC + FLIP_START + FLIP_WIDTH / 2
    expect(renewalGate(thetaC, mid)).toBeCloseTo(0.5, 10)
  })

  it('flips each vertex exactly once over the two laps (monotone in unwrapped rotation)', () => {
    const thetaC = canonicalTheta(2.7)
    let crossings = 0
    let prev = renewalGate(thetaC, 0)
    for (let r = 0; r <= 2 * TWO_PI; r += 0.005) {
      const g = renewalGate(thetaC, r)
      if ((prev < 0.5 && g >= 0.5) || (prev >= 0.5 && g < 0.5)) crossings++
      prev = g
    }
    expect(crossings).toBe(1)
  })
})

describe('girl-stance A/B boundary', () => {
  // The vertex under the girl has local theta = rotation + STANCE_ALPHA.
  const girlGate = (rotation: number): number =>
    renewalGate(canonicalTheta(rotation + STANCE_ALPHA), rotation)

  it('is exactly 0 for the whole of lap 1 (spring underfoot)', () => {
    for (let r = 0; r < TWO_PI - 1e-6; r += 0.01) expect(girlGate(r)).toBe(0)
  })

  it('is exactly 1 for the whole of lap 2 (autumn underfoot)', () => {
    for (let r = TWO_PI + 1e-6; r <= 2 * TWO_PI; r += 0.01) expect(girlGate(r)).toBe(1)
  })

  it('flips at exactly the lap boundary rotation = 2π', () => {
    expect(girlGate(TWO_PI - 1e-4)).toBe(0)
    expect(girlGate(TWO_PI + 1e-4)).toBe(1)
  })
})

describe('activeVariantAt', () => {
  it('uses the single shared 0.5 threshold (0 = A, 1 = B)', () => {
    const thetaC = 1.0
    expect(activeVariantAt(thetaC, thetaC)).toBe(0) // gate 0
    expect(activeVariantAt(thetaC, thetaC + FLIP_START + FLIP_WIDTH + 1)).toBe(1) // gate 1
    // exactly at the centre the gate is 0.5 ⇒ B (≥ 0.5)
    expect(activeVariantAt(thetaC, thetaC + FLIP_START + FLIP_WIDTH / 2)).toBe(1)
  })
})

describe('epilogueGate (Task 60 — the world ends in snow)', () => {
  it('sits exactly one turn after the renewal window', () => {
    expect(EPILOGUE_START).toBeCloseTo(FLIP_START + TWO_PI, 12)
    expect(EPILOGUE_WIDTH).toBe(FLIP_WIDTH)
  })

  it('is exactly 0 before its window and exactly 1 after it', () => {
    const thetaC = 1.0
    expect(epilogueGate(thetaC, thetaC + EPILOGUE_START - 0.01)).toBe(0)
    expect(epilogueGate(thetaC, thetaC + 2)).toBe(0) // still mid-JOURNEY, long past the A→B flip
    expect(epilogueGate(thetaC, thetaC + EPILOGUE_START + EPILOGUE_WIDTH + 0.01)).toBe(1)
  })

  it('rises monotonically and crosses 0.5 at the window centre', () => {
    const thetaC = 1.0
    let prev = -1
    for (let r = 0; r <= thetaC + EPILOGUE_START + EPILOGUE_WIDTH + 1; r += 0.01) {
      const g = epilogueGate(thetaC, r)
      expect(g).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = g
    }
    expect(epilogueGate(thetaC, thetaC + EPILOGUE_START + EPILOGUE_WIDTH / 2)).toBeCloseTo(0.5, 10)
  })

  // THE NON-CORRUPTION PROOF, as arithmetic rather than as a capture. A vertex is visible only
  // while `rotation − thetaC` is outside the proven-hidden band, i.e. below 0.9425 + 2π = 7.2257
  // on this turn. The epilogue cannot start before 7.6832. Chapter 4's desert is therefore
  // untouched everywhere it can be seen — including its entry, which is this band's leading edge.
  it('cannot alter anything the visitor can still see (q > 7.6832 > the 7.2257 visibility limit)', () => {
    const VISIBLE_UNTIL = 0.9425 + TWO_PI
    expect(EPILOGUE_START).toBeGreaterThan(VISIBLE_UNTIL)
    // and it has finished before the far side of the hidden band lets the vertex out again
    expect(EPILOGUE_START + EPILOGUE_WIDTH).toBeLessThan(2.906 + TWO_PI)
  })

  it('never overlaps the A→B window: mid-epilogue implies the A→B flip is long finished', () => {
    for (let thetaC = STANCE_ALPHA; thetaC < STANCE_ALPHA + TWO_PI; thetaC += 0.05) {
      for (let r = 0; r <= 2 * TWO_PI; r += 0.02) {
        const e = epilogueGate(thetaC, r)
        if (e > 0) expect(renewalGate(thetaC, r)).toBe(1)
      }
    }
  })

  // Scrub-back needs no separate mechanism and this is why: the gate holds no state, so the value
  // at a rotation is the same whether the visitor arrived there going forwards or backwards.
  it('is a pure function of rotation — the flip runs backwards through the same window', () => {
    const thetaC = 1.7
    // the SAME rotation values, visited in both orders (building two float ramps instead would
    // compare different rotations and prove nothing about direction)
    const rotations = Array.from({ length: 41 }, (_, i) => 8.0 + i * 0.05)
    const forward = rotations.map((r) => epilogueGate(thetaC, r))
    const backward = [...rotations].reverse().map((r) => epilogueGate(thetaC, r))
    expect(backward.reverse()).toEqual(forward)
  })

  // Scrubbing back out of the ending un-flips the snow, and that reversal has to be as hidden as
  // the flip was. It is, for the same reason and with the same numbers — but the direction is
  // asserted rather than argued, because "the reverse case is symmetric" is exactly the kind of
  // claim this lab has had to retract before.
  it('is mid-flip only inside the hidden band, scrubbing BACKWARDS out of the ending', () => {
    const HIDDEN_LO = 0.9425 + TWO_PI
    const HIDDEN_HI = 2.906 + TWO_PI
    for (let thetaC = STANCE_ALPHA; thetaC < EPILOGUE_END; thetaC += 0.05) {
      for (let r = 2 * TWO_PI; r >= 0; r -= 0.01) {
        const g = epilogueGate(thetaC, r)
        if (g > 0 && g < 1) {
          const q = r - thetaC
          expect(q).toBeGreaterThan(HIDDEN_LO)
          expect(q).toBeLessThan(HIDDEN_HI)
        }
      }
    }
  })

  it('completes for every longitude it covers before the journey stops turning', () => {
    // worst case is the far edge of the region plus the boundary wander
    const worst = EPILOGUE_END + 0.035
    expect(worst + EPILOGUE_START + EPILOGUE_WIDTH).toBeLessThan(2 * TWO_PI)
  })
})

describe('sceneVariantAt', () => {
  it('agrees with activeVariantAt everywhere outside the epilogue span', () => {
    for (let thetaC = EPILOGUE_END + 0.01; thetaC < STANCE_ALPHA + TWO_PI; thetaC += 0.07) {
      for (let r = 0; r <= 2 * TWO_PI; r += 0.09) {
        expect(sceneVariantAt(thetaC, r)).toBe(activeVariantAt(thetaC, r))
      }
    }
  })

  it('runs A → B → epilogue in order at a longitude inside the snow field', () => {
    const thetaC = 1.2
    expect(sceneVariantAt(thetaC, 0)).toBe(0)
    expect(sceneVariantAt(thetaC, thetaC + FLIP_START + FLIP_WIDTH + 0.5)).toBe(1)
    expect(sceneVariantAt(thetaC, 2 * TWO_PI)).toBe(2)
  })

  it('still shows the DESERT throughout chapter 4, when the girl is walking it', () => {
    // chapter 4 spans rotation [4π/3·1.5 …] — concretely, chapterStartRotation(3) = 6.2832 to
    // 8.3776. Every band-0 longitude must read variant B (desert) for that whole stretch.
    for (let thetaC = STANCE_ALPHA; thetaC <= 2.442; thetaC += 0.03) {
      for (let r = 6.2832; r <= 8.3776; r += 0.03) {
        expect(sceneVariantAt(thetaC, r)).toBe(1)
      }
    }
  })

  it('has the whole snow field in place by the final dwell (rotation 4π)', () => {
    for (let thetaC = STANCE_ALPHA; thetaC < EPILOGUE_END - 0.01; thetaC += 0.02) {
      expect(sceneVariantAt(thetaC, 2 * TWO_PI)).toBe(2)
    }
  })

  it('switches at the centre of the hidden band, not at its edge', () => {
    const thetaC = 1.2
    // the 0.5 crossing lands at q = EPILOGUE_START + WIDTH/2 = 8.1832, whose distance to either
    // end of the hidden band (7.2257, 9.1892) is the margin a prop swap gets
    const q = EPILOGUE_START + EPILOGUE_WIDTH / 2
    expect(q - (0.9425 + TWO_PI)).toBeGreaterThan(0.9)
    expect(2.906 + TWO_PI - q).toBeGreaterThan(1.0)
    expect(sceneVariantAt(thetaC, thetaC + q - 0.001)).toBe(1)
    expect(sceneVariantAt(thetaC, thetaC + q + 0.001)).toBe(2)
  })
})
