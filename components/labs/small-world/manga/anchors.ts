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
 *    subject sits just off-centre with fine detail near the middle. The pack asked
 *    for that composition because the leaf used to ZOOM 2.4x into the centre for a
 *    second beat; that beat is gone (Task 82 — one drawing printed twice), and the
 *    composition is what still makes `BAND` below catch all six with one window.
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

/**
 * THE BAND — which part of an anchor the leaf's picture actually shows.
 *
 * The anchors generate at 3:2 and the leaf cannot spend a 3:2 establishing shot on
 * a 2:3 page. The first version got there with `object-fit: cover`, which takes a
 * full-width slice through the middle of the whole illustration — and the blind
 * audit's verdict on that was exact: at ~100px tall it collapses to grey mush,
 * because most of a full-width slice is background.
 *
 * A band is a REAL CROP instead: a rectangle tight on the hands and the action, at
 * the panel's own aspect, so what survives the shrink is the part worth seeing.
 * `x`/`y`/`w` are fractions of the anchor; the height follows from the aspect, so
 * a band cannot be authored at the wrong shape.
 *
 * All six seeded at the same rectangle, which is a fact about the ART rather than
 * a shortcut: the pack composed every anchor with its subject just off-centre and
 * fine detail near the middle, so one window catches all of them. Per-anchor
 * because the moment one generation is re-rolled that stops being true.
 */
export type AnchorBand = { x: number; y: number; w: number }

/**
 * The picture panel's aspect.
 *
 * 2.45 while there were TWO of these stacked — the wide shot and its zoomed twin —
 * because a leaf 145cqw tall could not carry two pictures any taller than that and
 * still hold a hero. Task 82 killed the twin (one drawing printed twice is not a
 * beat), so the survivor gets the room both were squeezed into and reads as a
 * panel rather than a letterbox. 1.9 rather than the anchor's native 1.5: the
 * page still owes half its height to the hero and the sheet.
 */
export const BAND_ASPECT = 1.9
/** Every anchor is generated at 3:2. */
export const ANCHOR_ASPECT = 1.5

/** A band's height, in anchor fractions — derived so it is always the right shape. */
export const bandHeight = (w: number): number => (w * ANCHOR_ASPECT) / BAND_ASPECT

/** Public path of a prepared v3 asset. */
export const anchorSrc = (id: string): string => `/labs/small-world/manga/${id}.webp`

/**
 * The six anchors, in journey order. `ANCHORS[0]` is chapter 1 (Lyon).
 *
 * `y` is 0.19 rather than 0.3 because the band grew: at BAND_ASPECT 1.9 the window
 * is 0.695 of the anchor tall, and it is centred on the composition the pack put
 * the subject in. (At 2.45 it was 0.539 tall and 0.3 centred it.)
 */
const BAND: AnchorBand = { x: 0.06, y: 0.19, w: 0.88 }

export const ANCHORS: readonly (SheetArt & { band: AnchorBand })[] = [
  { id: 'anchor-1', ready: true, band: BAND }, // ch1 Lyon — hands planting a seedling by a textbook
  { id: 'anchor-2', ready: true, band: BAND }, // ch2 IU Networks — the honeycomb block snapping together
  { id: 'anchor-3', ready: true, band: BAND }, // ch3 Sportion — polishing the stone in the stream
  { id: 'anchor-4', ready: true, band: BAND }, // ch4 qiibee — the brush on a chest, thirteen receding
  { id: 'anchor-5', ready: true, band: BAND }, // ch5 Wooskill — the foundation stone by lantern
  { id: 'anchor-6', ready: true, band: BAND }, // ch6 Sync Design — the blueprint scroll, fox asleep
]

export const anchorFor = (chapterIndex: number): (SheetArt & { band: AnchorBand }) | undefined =>
  ANCHORS[chapterIndex]

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
