import { describe, expect, it } from 'vitest'
import { PLY, Z_GUARD, plyLift, rivetLift } from '@/components/labs/storybook/book/lift-ladder'
import { PAGE_SURFACE_Y, POPUP_Y, RIM_T } from '@/components/labs/storybook/book/book'
import { LIFT_CLEARANCE } from '@/components/labs/storybook/book/parallax-lift'
import { DECAL_LIFT } from '@/components/labs/storybook/book/cover-decals'
import { KEEPSAKE_POCKET_LIFT } from '@/components/labs/storybook/book/popup-keepsake'
import { DRESS_LIFT } from '@/components/labs/storybook/book/popup-anatomy'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import { CW_LIFT } from '@/components/labs/storybook/book/popup-keepwinch'
import { VOLVELLE_CARD_LIFT, VOLVELLE_LIFT } from '@/components/labs/storybook/book/popup-volvelle'
import { BALCONY_LIFT, PLATE_LIFT } from '@/components/labs/storybook/book/popup-keepstack'
import { PAPER_T, SHEET_LIFT } from '@/components/labs/storybook/book/turning-page'

// T2 lift ladder (systems-thickness-motion-pack.md §T2): every off-surface
// lift scattered across the popup layers must be an integer count of plies
// (glue-stack, static surfaces) or a rivet lift (plies + a fixed z-fight
// guard, moving solved panels). This test pins the migration so a future
// ad-hoc epsilon fails the build instead of silently drifting the ladder.
describe('lift ladder', () => {
  it('defines PLY and Z_GUARD at the shipped scale', () => {
    expect(PLY).toBe(0.002)
    expect(Z_GUARD).toBe(0.001)
  })

  it('plyLift/rivetLift compose from PLY and Z_GUARD', () => {
    expect(plyLift(1)).toBe(PLY)
    expect(plyLift(2)).toBe(2 * PLY)
    expect(rivetLift(1)).toBe(PLY + Z_GUARD)
    expect(rivetLift(2)).toBe(2 * PLY + Z_GUARD)
  })

  it('glue-stack class: every migrated static-surface lift equals plyLift(1)', () => {
    expect(LIFT_CLEARANCE).toBe(plyLift(1))
    expect(DECAL_LIFT).toBe(plyLift(1))
    expect(KEEPSAKE_POCKET_LIFT).toBe(plyLift(1))
    expect(POPUP_Y).toBe(PAGE_SURFACE_Y + plyLift(1))
  })

  it('rivet class: every migrated moving-panel lift equals rivetLift(1)', () => {
    expect(DRESS_LIFT).toBe(rivetLift(1))
    expect(ROTOR_LIFT).toBe(rivetLift(1))
    expect(CW_LIFT).toBe(rivetLift(1))
  })

  it('volvelle stays rotor-derived, unchanged by the ladder migration', () => {
    expect(VOLVELLE_LIFT).toBe(ROTOR_LIFT)
    expect(VOLVELLE_CARD_LIFT).toBe(2 * ROTOR_LIFT)
  })

  it('plate class: every migrated visual-thickness lift equals plyLift(2)', () => {
    expect(BALCONY_LIFT).toBe(plyLift(2))
    expect(PLATE_LIFT).toBe(plyLift(2))
    expect(SHEET_LIFT).toBe(plyLift(2))
    expect(PAPER_T).toBe(plyLift(2))
    expect(RIM_T).toBe(plyLift(2))
  })
})
