import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LOOK,
  LOOK_KEYS,
  LOOK_STORAGE_KEY,
  applyLookOverrides,
  isLookTuneEnabled,
  lookRevision,
  nonDefaultLook,
  parseLookOverrides,
  parseLookStorage,
  resetLook,
  setLook,
  subscribeLook,
} from '@/components/labs/small-world/scene/look-table'
import { isTuneEnabled } from '@/components/labs/small-world/scene/tunables'
import {
  AMBIENT_INTENSITY,
  STUDIO_AMBIENT_INTENSITY,
} from '@/components/labs/small-world/scene/biome-atmosphere'
import { ENDING_DPR_FLOOR } from '@/components/labs/small-world/scene/ending-dpr'

/**
 * THE LOOK TABLE (T130).
 *
 * The table is three numbers and a store, and almost nothing about it is worth testing twice. What
 * IS worth gating is the part that cannot be seen by reading the file: that each row's range is
 * still tied to the lighting constant it was derived from, that the override path cannot fire for
 * a reader who did not ask for it, and that a persisted session cannot outrank an explicit capture
 * flag. Those are the three ways this becomes a bug rather than a dial.
 */

afterEach(() => resetLook())

describe('the rows are the shipped decisions', () => {
  it('defaults to Aram’s picks: the safe ambient rung, the full bake, the ending’s density', () => {
    expect(LOOK.ambient.default).toBe(1.0)
    expect(LOOK.occStrength.default).toBe(1)
    expect(LOOK.journeyDpr.default).toBe(2)
  })

  it('keeps every row a usable slider', () => {
    for (const k of LOOK_KEYS) {
      const r = LOOK[k]
      expect(r.min, `${k} min ≤ default`).toBeLessThanOrEqual(r.default)
      expect(r.default, `${k} default ≤ max`).toBeLessThanOrEqual(r.max)
      expect(r.step, `${k} step`).toBeGreaterThan(0)
      expect(r.max - r.min, `${k} range`).toBeGreaterThanOrEqual(r.step)
      expect(r.label.length, `${k} label`).toBeGreaterThan(0)
    }
  })

  it('spans the ambient row between the two REAL lighting constants, not two typed numbers', () => {
    // The whole argument for this row is "the journey's fill, walked toward the desk's". Written as
    // literals for the leaf-module reason in look-table.ts's header — so the promise is kept here.
    // If either end drifts, the dial stops meaning what its documentation says it means.
    expect(LOOK.ambient.min).toBe(AMBIENT_INTENSITY)
    expect(LOOK.ambient.max).toBe(STUDIO_AMBIENT_INTENSITY)
    // ...and the shipped default is genuinely between them: T127 measured 1.62 muddying three
    // biomes and 1.00 muddying none, so this is a rung on that ladder rather than a compromise.
    expect(LOOK.ambient.default).toBeGreaterThan(LOOK.ambient.min)
    expect(LOOK.ambient.default).toBeLessThan(LOOK.ambient.max)
  })

  it('cannot ask for more pixels than the Canvas ceiling can give', () => {
    // `scene.tsx` mounts dpr={[1, 2]} and T79 established that above 2 this lab renders no extra
    // pixels at all, so a journey floor above the ending's would be a contradiction, not a knob.
    expect(LOOK.journeyDpr.max).toBe(ENDING_DPR_FLOOR)
    // ...and 1 must stay reachable, because it is the pre-T130 behaviour and therefore the revert.
    expect(LOOK.journeyDpr.min).toBe(1)
  })
})

describe('the store', () => {
  it('clamps to the row’s range rather than trusting the caller', () => {
    setLook('ambient', 99)
    expect(LOOK.ambient.value).toBe(LOOK.ambient.max)
    setLook('ambient', -5)
    expect(LOOK.ambient.value).toBe(LOOK.ambient.min)
  })

  it('ignores a non-number instead of poisoning a uniform with NaN', () => {
    setLook('ambient', Number.NaN)
    expect(LOOK.ambient.value).toBe(LOOK.ambient.default)
  })

  it('notifies on a change and stays silent on a no-op', () => {
    const seen = vi.fn()
    const off = subscribeLook(seen)
    const before = lookRevision()
    setLook('occStrength', 0.5)
    expect(seen).toHaveBeenCalledTimes(1)
    setLook('occStrength', 0.5)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(lookRevision()).toBe(before + 1)
    off()
    setLook('occStrength', 0.25)
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('exports only what was moved, so a settled set is readable at a glance', () => {
    expect(nonDefaultLook()).toEqual({})
    setLook('ambient', 1.3)
    expect(nonDefaultLook()).toEqual({ ambient: 1.3 })
    resetLook()
    expect(nonDefaultLook()).toEqual({})
  })
})

describe('the overrides cannot reach a reader', () => {
  it('answers to the same flag the shipped panel does', () => {
    // Two gates that disagree would let a look row be adjustable under a flag the panel does not
    // render for — an override with no visible control, which is the worst of both.
    for (const s of ['', '?tune=1', '?tune=0', '?tune', '?tune=1&ambient=1.3', '?ambient=1.3']) {
      expect(isLookTuneEnabled(s), s).toBe(isTuneEnabled(s))
    }
  })

  it('ignores every value without the flag — a shared link renders the shipped look', () => {
    expect(parseLookOverrides('?ambient=1.62&journeyDpr=1')).toEqual({})
    applyLookOverrides('?ambient=1.62', null)
    expect(LOOK.ambient.value).toBe(LOOK.ambient.default)
  })

  it('reads only known, finite rows', () => {
    expect(parseLookOverrides('?tune=1&ambient=1.3&occStrength=0.4')).toEqual({
      ambient: 1.3,
      occStrength: 0.4,
    })
    expect(parseLookOverrides('?tune=1&ambient=banana&nonsense=3')).toEqual({})
  })

  it('clamps an override through the same door a slider uses', () => {
    applyLookOverrides('?tune=1&ambient=99', null)
    expect(LOOK.ambient.value).toBe(LOOK.ambient.max)
  })
})

describe('persistence', () => {
  const fakeStore = (initial: string | null) => {
    let held = initial
    return {
      getItem: (k: string) => (k === LOOK_STORAGE_KEY ? held : null),
      setItem: (k: string, v: string) => {
        if (k === LOOK_STORAGE_KEY) held = v
      },
      read: () => held,
    }
  }

  it('restores a settled session', () => {
    applyLookOverrides('?tune=1', fakeStore(JSON.stringify({ ambient: 1.4 })))
    expect(LOOK.ambient.value).toBe(1.4)
  })

  it('lets an explicit flag outrank whatever the last session left behind', () => {
    // The capture case: a run pinned at `&ambient=1.62` must render 1.62, not yesterday's 1.4.
    applyLookOverrides('?tune=1&ambient=1.62', fakeStore(JSON.stringify({ ambient: 1.4 })))
    expect(LOOK.ambient.value).toBe(1.62)
  })

  it('survives a hand-edited or corrupt entry', () => {
    expect(parseLookStorage('not json')).toEqual({})
    expect(parseLookStorage(null)).toEqual({})
    expect(parseLookStorage('[1,2,3]')).toEqual({})
    expect(parseLookStorage(JSON.stringify({ ambient: 'x', occStrength: 0.5 }))).toEqual({
      occStrength: 0.5,
    })
  })

  it('writes only while ?tune is live', () => {
    const off = fakeStore(null)
    applyLookOverrides('', off)
    setLook('ambient', 1.2)
    expect(off.read(), 'a reader must not carry a developer’s session').toBeNull()

    const on = fakeStore(null)
    applyLookOverrides('?tune=1', on)
    setLook('ambient', 1.3)
    expect(JSON.parse(on.read() as string)).toEqual({ ambient: 1.3 })
  })
})
