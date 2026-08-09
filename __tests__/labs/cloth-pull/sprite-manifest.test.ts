import { existsSync, readFileSync } from 'node:fs'
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

  /* ---- horizontal registration ---------------------------------------- *
   *
   * The vertical law above has a twin. Every frame is cropped to its own ink
   * bbox and that bbox is set by her FEET — in a stride they are her widest
   * horizontal extent — so drawing each frame centred on its bbox slid her
   * BODY sideways while her feet held station: 0.052 figure heights of head
   * travel across the walk cycle, its worst jump between two ADJACENT keys and
   * restated eight times per 0.85s stride, plus a 0.16 lurch when she changed
   * pose group. That is the inverse of a walk.
   *
   * `regX` is the pipeline's answer: the world-px offset (at STAND_H) that
   * lands every frame's measured body where the reference frame's sits. These
   * assertions are the law it has to keep.
   */

  /** her drawn height on screen, world px at STAND_H — the unit of the law */
  const figH = SPRITE_FRAMES[0].inkH * SPRITE_FRAMES[0].worldScale
  /** where a frame-px landmark lands on screen under a given registration */
  const lands = (f: (typeof SPRITE_FRAMES)[number], mark: number, reg: number) =>
    (mark - f.w / 2) * f.worldScale + reg
  const travel = (v: readonly number[]) => (Math.max(...v) - Math.min(...v)) / figH

  /* The tolerance is the diagnosis's own ruler, not a number chosen to pass.
   * The walk advances a foot S/8 = 0.026 figure heights per key, and half a
   * step — 0.013 — is the loosest band that still preserves the ordering of
   * the eight keys. Her body may not wander further than the stride's own
   * half-step, or the shuffle is legible against the walk it sits on.
   * Measured: 0.006 registered, against 0.052 bbox-centred. */
  const WALK_CEIL = 0.013
  /* Pose-group changes are deliberate events rather than a cycle, so they get
   * a looser band. Measured 0.010 registered, against 0.161 bbox-centred. */
  const ALL_CEIL = 0.02

  it('holds her body still across the walk cycle', () => {
    const now = SPRITE_WALK.map((f) => lands(f, f.headX, f.regX))
    expect(
      travel(now),
      `head travels ${travel(now).toFixed(4)} figH across the walk`
    ).toBeLessThan(WALK_CEIL)
  })

  it('does not move her sideways when she changes pose group', () => {
    const now = SPRITE_FRAMES.map((f) => lands(f, f.headX, f.regX))
    expect(
      travel(now),
      `head travels ${travel(now).toFixed(4)} figH across all frames`
    ).toBeLessThan(ALL_CEIL)
  })

  /* Without this the pair above would be asserting their own construction: a
   * `regX` of all zeros with a `headX` pinned to each frame's centre would
   * satisfy them and ship the defect. This measures what the SAME landmarks do
   * under the registration that was replaced — centre each frame on its crop —
   * and requires it to fail the same ceilings. So the manifest has to carry a
   * real per-frame correction, and the correction has to be the thing that
   * removes the travel. */
  it('carries a correction that is doing the work', () => {
    const wasWalk = SPRITE_WALK.map((f) => lands(f, f.headX, 0))
    const wasAll = SPRITE_FRAMES.map((f) => lands(f, f.headX, 0))
    expect(
      travel(wasWalk),
      `bbox-centring leaves ${travel(wasWalk).toFixed(4)} figH of walk travel — ` +
        `at or under the ${WALK_CEIL} ceiling the registration is a no-op`
    ).toBeGreaterThan(WALK_CEIL)
    expect(
      travel(wasAll),
      `bbox-centring leaves ${travel(wasAll).toFixed(4)} figH of travel across all frames`
    ).toBeGreaterThan(ALL_CEIL)
  })

  /* `regX` is a derived number and `bodyX` is the measurement it derives from.
   * If a regeneration re-measures the frames but the offsets are stale — or
   * hand-edited — she is registered to art that is no longer there. */
  it('derives every offset from the body landmark it claims to use', () => {
    const put = (f: (typeof SPRITE_FRAMES)[number]) =>
      (f.w / 2 - f.bodyX) * f.worldScale
    const ref = put(SPRITE_FRAMES[0])
    for (const f of SPRITE_FRAMES)
      expect(f.regX, `${f.name} regX does not follow from its bodyX`).toBeCloseTo(
        put(f) - ref,
        1
      )
    // the reference frame is where she already stood; registering must not
    // shift the whole character against the cloth and the stage
    expect(SPRITE_FRAMES[0].regX).toBe(0)
  })

  /* `bodyX`, `headX` and `anchorX` are all in FRAME pixels, so they are only
   * meaningful against the frame they were measured on. Re-derive each frame's
   * dimensions from the shipped .webp itself — the VP8X chunk carries the
   * canvas size — so a sheet re-exported at another size cannot silently leave
   * the registration pointing at the wrong part of her. */
  const webpSize = (file: string) => {
    const b = readFileSync(file)
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP')
      throw new Error(`${file} is not a WebP file`)
    let o = 12
    while (o + 8 <= b.length) {
      const tag = b.toString('ascii', o, o + 4)
      const size = b.readUInt32LE(o + 4)
      if (tag === 'VP8X')
        return { w: b.readUIntLE(o + 12, 3) + 1, h: b.readUIntLE(o + 15, 3) + 1 }
      o += 8 + size + (size & 1)
    }
    throw new Error(`${file} carries no VP8X chunk`)
  }

  it('measures the frames it actually ships', () => {
    for (const f of SPRITE_FRAMES) {
      const got = webpSize(
        join(process.cwd(), 'public/labs/cloth-pull/sprites', `${f.name}.webp`)
      )
      expect(got.w, `${f.name} ships ${got.w}px wide, manifest says ${f.w}`).toBe(f.w)
      expect(got.h, `${f.name} ships ${got.h}px tall, manifest says ${f.h}`).toBe(f.h)
      expect(f.bodyX, f.name).toBeGreaterThan(0)
      expect(f.bodyX, f.name).toBeLessThan(f.w)
      expect(f.headX, f.name).toBeGreaterThan(0)
      expect(f.headX, f.name).toBeLessThan(f.w)
    }
  })

  /* The strings hang off `anchorX`, which is offset from the frame centre and
   * therefore rides `regX` with the rest of the frame. Her hands are clasped
   * BEHIND her back and she faces +x, so the anchor must sit behind her body
   * in every frame. It fires if the offset is ever applied to the anchor a
   * second time, which would walk the strings off her hands. */
  it('leaves the fist anchor behind her body, where her hands are drawn', () => {
    for (const f of SPRITE_FRAMES)
      expect(
        f.anchorX,
        `${f.name} puts the fist anchor ${f.anchorX} ahead of her body at ${f.bodyX}`
      ).toBeLessThan(f.bodyX)
  })
})
