/**
 * THE ONE GATE ON A DELIBERATE DUPLICATION.
 *
 * `wild/key-physics.ts` carries its own copy of the crank mapping (`tangentialTurn`) instead of
 * calling `book/handle-projection.ts`'s `crankTangentialDelta`. That is not an oversight: the
 * physics core must stay import-free so `scripts/storybook/bench/e5-keyfeel.mjs` can run the real
 * mechanism in plain node, and handle-projection imports three.
 *
 * Duplicated maths drifts silently, so it is pinned here. If CLASS B2-T is ever re-derived, this
 * fails and the key's copy has to follow — which is the whole point of writing it down.
 */

import { describe, expect, it } from 'vitest'

import { crankTangentialDelta } from '@/components/labs/storybook/book/handle-projection'
import { KEY_FEEL, tangentialTurn } from '@/components/labs/storybook/wild/key-physics'

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
}

describe('key-physics tangentialTurn matches handle-projection crankTangentialDelta', () => {
  it('agrees on 500 random hit pairs, including through-hub and far-field strokes', () => {
    const rnd = rng(0x51ced)
    for (let i = 0; i < 500; i++) {
      const a0 = (rnd() * 2 - 1) * Math.PI
      const a1 = (rnd() * 2 - 1) * Math.PI
      const r0 = rnd() * 0.6
      const r1 = rnd() * 0.6
      const mine = tangentialTurn(
        r0 * Math.cos(a0),
        r0 * Math.sin(a0),
        r1 * Math.cos(a1),
        r1 * Math.sin(a1),
        KEY_FEEL.refR,
      )
      const theirs = crankTangentialDelta({ angle: a0, r: r0 }, { angle: a1, r: r1 }, KEY_FEEL.refR)
      expect(mine).toBeCloseTo(theirs, 12)
    }
  })

  it('keeps the properties the winch bought: antisymmetry, 1:1 at the reference radius, dead hub', () => {
    const R = KEY_FEEL.refR
    const fwd = tangentialTurn(R, 0, R * Math.cos(0.4), R * Math.sin(0.4), R)
    const rev = tangentialTurn(R * Math.cos(0.4), R * Math.sin(0.4), R, 0, R)
    expect(fwd + rev).toBeCloseTo(0, 12)
    expect(fwd).toBeCloseTo(0.4, 2)
    // A stroke straight across the face slides the paper under the finger and turns nothing.
    expect(tangentialTurn(-0.25, 0, 0.25, 0, R)).toBeCloseTo(0, 12)
    // Half the radius, half the turn — as paper does.
    const half = tangentialTurn(R / 2, 0, (R / 2) * Math.cos(0.4), (R / 2) * Math.sin(0.4), R)
    expect(half).toBeCloseTo(fwd / 2, 6)
  })
})
