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

  it('keeps every fist anchor inside its own frame', () => {
    for (const f of SPRITE_FRAMES) {
      expect(f.anchorX, f.name).toBeGreaterThanOrEqual(0)
      expect(f.anchorY, f.name).toBeGreaterThanOrEqual(0)
      expect(f.anchorX, f.name).toBeLessThan(f.w)
      expect(f.anchorY, f.name).toBeLessThan(f.h)
    }
  })
})
