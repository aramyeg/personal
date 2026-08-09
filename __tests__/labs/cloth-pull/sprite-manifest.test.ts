import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SPRITE_FRAMES,
  SPRITE_HOLD,
  SPRITE_HOLD_I0,
  SPRITE_STRAIN,
  SPRITE_STRAIN_I0,
  SPRITE_WALK,
  SPRITE_WALK_I0,
} from '@/lib/labs/cloth-pull/sprite-manifest'

/* The manifest is machine-generated from whatever sheets the slice script was
 * pointed at, and the runtime indexes into it by group offset. A regeneration
 * that drops or reorders a frame stays type-correct and fails silently at
 * runtime — as a texture that never loads, or a strain pose that plays the
 * hold. These are the invariants that cannot be re-derived from the file
 * itself, so they are asserted rather than mirrored. */
describe('cloth-pull sprite manifest', () => {
  it('groups partition the frame list in order', () => {
    expect(SPRITE_WALK_I0).toBe(0)
    expect(SPRITE_WALK_I0).toBeLessThan(SPRITE_STRAIN_I0)
    expect(SPRITE_STRAIN_I0).toBeLessThan(SPRITE_HOLD_I0)
    expect(SPRITE_WALK.length + SPRITE_STRAIN.length + SPRITE_HOLD.length).toBe(
      SPRITE_FRAMES.length
    )
  })

  it('each group offset lands on a frame of that group', () => {
    expect(SPRITE_WALK.every((f) => f.name.startsWith('walk_'))).toBe(true)
    expect(SPRITE_STRAIN.every((f) => f.name.startsWith('strain_'))).toBe(true)
    expect(SPRITE_HOLD.every((f) => f.name.startsWith('hold_'))).toBe(true)
  })

  it('carries the three strain levels the runtime selects by effort', () => {
    // sprite-chibi.tsx addresses these as SPRITE_STRAIN_I0 + (level - 1)
    expect(SPRITE_STRAIN.length).toBe(3)
    expect(SPRITE_HOLD.length).toBeGreaterThanOrEqual(1)
  })

  /* sprite-chibi.tsx steps the stride phase WALK_STEPS=8 times and folds by
   * this length. At 8 drawn keys the fold is the identity; at any count that
   * does not divide 8 the cycle would skip keys and jump at the loop point,
   * which reads as a limp rather than as a broken build. */
  it('carries a walk cycle the runtime can step through evenly', () => {
    expect(SPRITE_WALK.length).toBe(8)
    expect(8 % SPRITE_WALK.length).toBe(0)
  })

  it('ships a texture file for every frame', () => {
    for (const f of SPRITE_FRAMES) {
      const p = join(
        process.cwd(),
        'public/labs/cloth-pull/sprites',
        `${f.name}.webp`
      )
      expect(existsSync(p), `missing texture for ${f.name}`).toBe(true)
    }
  })

  /* The law this asserts is scale continuity: the runtime draws every frame
   * with one formula, so her on-screen size may only change when the ART
   * changes, never because she switched pose group. Registration matches head
   * width WITHIN a group; nothing reconciled the groups, and she shrank 15.7%
   * the moment she started heaving. The measured landmark travels in the
   * manifest so the invariant can be re-derived here rather than eyeballed. */
  it('draws every pose group at one world scale', () => {
    const onScreen = SPRITE_FRAMES.map((f) => f.bodyR * f.worldScale)
    const ref = onScreen[0]
    for (let i = 0; i < SPRITE_FRAMES.length; i++) {
      expect(
        Math.abs(onScreen[i] / ref - 1),
        `${SPRITE_FRAMES[i].name} draws ${((onScreen[i] / ref - 1) * 100).toFixed(1)}% off the reference size`
      ).toBeLessThan(0.02)
    }
  })

  /* The landmark that owns the scale moved at Task 04, and this is the law
   * that made it move — so it is asserted rather than left as a comment.
   *
   * The eight walk sheets were generated one at a time and disagree about her
   * head-to-body ratio by ~21%. No uniform scale can make head width AND
   * figure height both uniform; it can only choose which one absorbs the
   * disagreement. Normalising on head width (what shipped through 03c) put the
   * whole 21% into her HEIGHT — 816..991px, strobing eight times per 0.85s
   * stride — which is a worse size defect than the 15.7% shrink the world
   * scale pass was written to cure, and it passed the old 2% assertion at
   * exactly 0.0% because it was asserting its own construction.
   *
   * sqrt(drawn area) splits it instead: ~10% residual on each axis. This
   * asserts the SPLIT, which is the property a landmark change can silently
   * lose. Either lopsided choice lands ~21% on one axis and fails here. */
  const spread = (v: readonly number[]) => Math.max(...v) / Math.min(...v) - 1

  it('spends the sheets’ size drift evenly instead of on one axis', () => {
    const head = SPRITE_WALK.map((f) => f.headW * f.worldScale)
    const height = SPRITE_WALK.map((f) => f.inkH * f.worldScale)
    // measured 9.7% and 10.5%; the ceiling admits drift, not a lopsided scale
    expect(
      spread(head),
      `walk head width spread is ${(spread(head) * 100).toFixed(1)}%`
    ).toBeLessThan(0.13)
    expect(
      spread(height),
      `walk figure height spread is ${(spread(height) * 100).toFixed(1)}%`
    ).toBeLessThan(0.13)
  })

  /* Cross-group HEIGHT is deliberately not asserted: the strain poses are a
   * forward crouch and are legitimately shorter, the hold pose stands upright
   * and is legitimately taller. Head width is the thing that must not jump
   * when she changes pose group — that is the 15.7% shrink, restated with a
   * tolerance the art can actually meet. */
  it('does not resize her head when she changes pose group', () => {
    const head = SPRITE_FRAMES.map((f) => f.headW * f.worldScale)
    expect(
      spread(head),
      `cross-group head width spread is ${(spread(head) * 100).toFixed(1)}%`
    ).toBeLessThan(0.13)
  })

  it('keeps every fist anchor inside its own frame', () => {
    for (const f of SPRITE_FRAMES) {
      expect(f.anchorX, f.name).toBeGreaterThanOrEqual(0)
      expect(f.anchorY, f.name).toBeGreaterThanOrEqual(0)
      expect(f.anchorX, f.name).toBeLessThan(f.w)
      expect(f.anchorY, f.name).toBeLessThan(f.h)
    }
  })
})
