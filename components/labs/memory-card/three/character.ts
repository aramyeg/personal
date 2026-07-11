/**
 * The character fits and the idle clip baked into each. Named for their ROLE,
 * never an identity — the assets are drop-in swappable and nothing here assumes
 * one (character-agnostic law: no gendered names anywhere near them). This is the
 * single canonical definition of the fit source paths + the shared clip name.
 *
 * Each save wears a fit (saves.ts maps slot→fit 1..FIT_COUNT); every fit GLB
 * ships exactly one looped idle clip under the canonical name below, all rigged
 * to the same shared skeleton so a swap re-dresses the figure without reposing.
 */

/** Canonical name of the single idle clip baked into every fit GLB. */
export const CHARACTER_IDLE_CLIP = 'fit-idle'

/** How many distinct fits exist on disk (char-fit1..char-fit6), one per save. */
export const FIT_COUNT = 6

/** Absolute public URL of a fit's GLB, keyed by its 1-based fit number. */
export function fitSrc(fit: number): string {
  return `/labs/memory-card/models/fits/char-fit${fit}.glb`
}
