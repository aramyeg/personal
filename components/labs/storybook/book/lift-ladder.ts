/**
 * The book's stack-order ladder (T2, systems-thickness-motion-pack.md §T2):
 * codifies the ad-hoc 0.0015/0.002/0.003/0.004 off-surface lifts scattered
 * across the popup layers into two named classes so stack order is always
 * an integer count of plies, and no future piece invents its own epsilon.
 *
 * Two classes:
 * - `plyLift(n)` — a glue-stack lift on a STATIC surface (page/board): n
 *   plies, no extra guard.
 * - `rivetLift(n)` — a lift on a MOVING solved panel (rivets/discs riding a
 *   live quad): n plies PLUS a fixed z-fight guard, since an obliquely
 *   viewed moving panel needs the extra margin the shipped constants
 *   already carried (0.003 = 1 ply + guard).
 *
 * NOT ladder members (documented here, left alone):
 * - `SHADOW_Y_LIFT` (0.001) and `CREASE_Y`'s `+0.001` — shadow/AO decal
 *   z-guards, not paper stock; half a ply by convention.
 * - `SHEET_STACK_T` (0.014) / `STACK_PEDESTAL` — the book-block visual
 *   model, an unrelated scale.
 * - `RIBBON_T` (0.005, T1) — a thickness ILLUSION width, not a stack lift.
 * - Keepsake's `KEEPSAKE_POPUP_WORLD_Y` — a derived composite, not a raw
 *   lift.
 */

/** One paper ply at world scale. Stack order = integer plies. */
export const PLY = 0.002

/** Glue-stack lift on a STATIC surface (page/board): n plies. */
export const plyLift = (n: number): number => n * PLY

/** Fixed z-fight guard added on top of rivet lifts — obliquely-viewed
 *  moving panels need the extra margin (the shipped 0.003 = 1 ply + guard). */
export const Z_GUARD = 0.001

/** Rivet lift on a MOVING solved panel: n plies + Z_GUARD. */
export const rivetLift = (n: number): number => n * PLY + Z_GUARD
