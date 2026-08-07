/**
 * THE INFO LEAF'S OWN ART — six generated anchor panels and two sprite sheets.
 *
 * ============================================================================
 * WHY THIS EXISTS: REDISTRIBUTION IS DEAD
 * ============================================================================
 * For one round the info leaf borrowed a panel from the chapter's story page and
 * that page rendered without it, so no panel appeared twice on a spread. Measured,
 * the operation was survivable on two chapters of six and left a 26–27% hole in
 * the middle of the composition on two others.
 *
 * Aram's ruling killed it outright, and on the stronger ground: a page with a
 * panel torn out of it reads as DAMAGED however carefully the remainder is
 * re-pasted, and that is true even on the chapters where the arithmetic was clean.
 * Story pages render whole. The info leaf gets art of its own.
 *
 * ============================================================================
 * THE CONTRACT WITH THE ART
 * ============================================================================
 * From the v3 prompt pack (`.superpowers/sdd/alwina-manga-prompts-v3.md`):
 *
 *  - SIX ANCHORS, `anchor-1` … `anchor-6`, one per chapter in journey order. Each
 *    is a SINGLE landscape panel at roughly 3:2 with one black border, and its
 *    subject sits just off-centre with fine detail near the middle — because the
 *    leaf zooms `ZOOM` into the centre of it for beat 2. The zoom is the reason
 *    the pack specifies the composition, so the two are one agreement and the
 *    number lives here rather than in both places.
 *  - CHIBI RUN SHEET, `chibi-run`: six side-view poses in a horizontal row, her
 *    trailing hand gripping a BLANK banner. The banner is blank because the site
 *    draws the cloth and the words on it (`cloth-drag.tsx`).
 *  - REACTION SHEET, `reactions`: six bust portraits in a 3x2 grid, for the
 *    chaser panel under the hero number.
 *
 * ============================================================================
 * HOW TO LAND THE ART
 * ============================================================================
 * The generations arrive as PNGs in `.superpowers/manga/v3/`. Run them through the
 * same pipeline the story pages use (`scripts/small-world/prepare-manga.mjs` —
 * greyscale, lanczos3, webp, and the hatching-energy gate that already rejected
 * one encoder for eating screentone), then flip `ready` below. Nothing else in the
 * leaf changes: the slot, the zoom and the layout are already built against these
 * declarations, which is the point of them existing before the files do.
 *
 * Until then `ready: false` and the leaf falls back to a crop of the chapter's own
 * printed page — so the mechanism is capturable and reviewable now, and the swap
 * when the art lands is one boolean per chapter.
 */

export type SheetArt = {
  /** File stem, and the public path stem. */
  id: string
  /** False while the generation has not landed; the consumer falls back. */
  ready: boolean
}

/** Public path of a prepared v3 asset. */
export const anchorSrc = (id: string): string => `/labs/small-world/manga/${id}.webp`

/**
 * How far beat 2 zooms into the anchor's centre.
 *
 * 2.4x, and it is the same 2.4 the pack was written against — an establishing
 * shot and a detail that is obviously the SAME picture closer in. Below about 2x
 * the two beats read as one shot printed twice; far above it the detail stops
 * being locatable in the wide shot and the triad breaks.
 */
export const ZOOM = 2.4

/** The six anchors, in journey order. `ANCHORS[0]` is chapter 1 (Lyon). */
export const ANCHORS: readonly SheetArt[] = [
  { id: 'anchor-1', ready: true }, // ch1 Lyon — hands planting a seedling in a textbook-propped pot
  { id: 'anchor-2', ready: true }, // ch2 IU Networks — the honeycomb block snapping together
  { id: 'anchor-3', ready: true }, // ch3 Sportion — polishing the stone in the stream
  { id: 'anchor-4', ready: true }, // ch4 qiibee — the brush-stroke on a chest, thirteen receding
  { id: 'anchor-5', ready: true }, // ch5 Wooskill — the foundation stone by lantern
  { id: 'anchor-6', ready: true }, // ch6 Sync Design — the blueprint scroll, fox asleep
]

export const anchorFor = (chapterIndex: number): SheetArt | undefined => ANCHORS[chapterIndex]

/**
 * The chibi run cycle. Six poses in one horizontal row, so a frame is
 * `100 / FRAMES` percent of the sheet and the sprite is a background-position step.
 */
/**
 * THE RUN CYCLE, PRE-RENDERED FROM THE RIG.
 *
 * The 2D run sheet the prompt pack asked for was cancelled: Aram delivered a
 * RIGGED 3D chibi instead. It cannot ship as it stands — `chibi-run.glb` is
 * 11,289,816 bytes, almost all of it one PNG texture, on a route that already
 * carries a WebGL scene. So the cycle is baked to sprite frames offline
 * (`scratchpad/t74/render-chibi.mjs` + `ink-frames.mjs` + `sheet.mjs`): ten poses
 * over the clip's 0.667s, side-on, orthographic, toon-shaded, then inked to a
 * hard contour and three flat bands.
 *
 *     11,289,816 B  ->  34,666 B      326x smaller, and it is the ONLY thing on
 *                                      the wire; the GLB stays in .superpowers.
 *
 * TEN, not the pack's six: the rig's cycle is one full stride and sampling it at
 * six left a visible skip at the foot plant.
 */
export const CHIBI_SHEET: SheetArt & { frames: number } = {
  id: 'chibi-run',
  ready: true,
  frames: 10,
}

/** The reaction busts: a 3x2 grid, indexed row-major in the pack's own order. */
export const REACTION_SHEET: SheetArt & { cols: number; rows: number } = {
  id: 'reactions',
  ready: true,
  cols: 3,
  rows: 2,
}

/** The pack's reaction order, so a chapter can ask for a face by name. */
export const REACTIONS = ['stunned', 'delighted', 'proud', 'determined', 'sheepish', 'cool'] as const
export type ReactionName = (typeof REACTIONS)[number]

/** Where a named reaction sits on the sheet, as background-position percentages. */
export function reactionCell(name: ReactionName): { x: number; y: number } {
  const i = REACTIONS.indexOf(name)
  const col = i % REACTION_SHEET.cols
  const row = Math.floor(i / REACTION_SHEET.cols)
  // With `background-size: (cols*100)% (rows*100)%`, the position that shows cell
  // `n` is `n / (n_total - 1)` of the way across — not `n / n_total`.
  return {
    x: (col / (REACTION_SHEET.cols - 1)) * 100,
    y: (row / (REACTION_SHEET.rows - 1)) * 100,
  }
}
