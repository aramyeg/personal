/**
 * Design tokens for the Memory Card lab. This lab escapes the site's global
 * design tokens entirely — nothing here reads `globals.css` CSS variables;
 * every color and scale a section needs comes from this module.
 *
 * Layered primitive → semantic → component (design-system convention,
 * adapted to a single-file module since there's no CSS-variable pipeline
 * here): raw palette first, then purpose aliases built on top of it
 * (cycling order, section→glyph mapping, glyph geometry), then the
 * per-role type scale components actually consume.
 */

// ---- Primitive: raw palette ---------------------------------------------
// Gates tune ONLY these values — every consumer reads through the
// semantic/component layers below, never a hardcoded hex.
//
// The surface is a three-stop cool near-black — the PS2 browser "void". `ink`
// is the base plane every section sits on and the dark text on printed label
// stock; `abyss` is the deepest stop (screen edges, the far floor); `haze` is
// the faintly-lifted upper atmosphere the void grades up into. All three read
// as one continuous void behind the transparent 3D canvases.
export const MC = {
  ink: '#0d0e14',
  abyss: '#060609',
  haze: '#181924',
  paper: '#e9e7e0',
  shell: '#b7b9bd',
  warmGrey: '#8f8c84',
  glyphs: {
    triangle: '#00ac9f',
    circle: '#df0024',
    cross: '#2e6db4',
    square: '#d651a7',
  },
} as const

export type GlyphName = keyof typeof MC.glyphs

// ---- Semantic: purpose aliases over the primitive palette ---------------

/** Canonical cycling order — same rule the old poster generators used. */
export const GLYPH_ORDER: GlyphName[] = ['triangle', 'circle', 'cross', 'square']

/** idx % 4 cycling — same rule the old poster generators used. */
export function accentFor(i: number): string {
  return MC.glyphs[GLYPH_ORDER[i % GLYPH_ORDER.length]]
}

const hexToRgb = (hex: string): string =>
  hex
    .replace('#', '')
    .match(/\w\w/g)!
    .map((h) => parseInt(h, 16))
    .join(',')

/** Any token hex at reduced opacity — the one sanctioned way to build an rgba
 *  from a palette colour (accent atmosphere, glow pools, hairlines). Never
 *  hand-write an rgba() outside this module. */
export function withAlpha(hex: string, a: number): string {
  return `rgba(${hexToRgb(hex)},${a})`
}

/** Paper at reduced opacity — the sanctioned way to dim light-on-ink text/rules. */
export function paperAlpha(a: number): string {
  return withAlpha(MC.paper, a)
}

/** Ink at reduced opacity — the sanctioned way to dim dark-on-paper text/rules. */
export function inkAlpha(a: number): string {
  return withAlpha(MC.ink, a)
}

/**
 * The character-select void: a layered CSS background string for the whole
 * stage, tinted by the active save's accent. A soft accent atmosphere pools
 * high-centre (behind the objects), a cool radial lifts the mid-stage out of
 * the abyss, and a reflective floor band warms the lower third so the 3D
 * objects read as standing on a lit plane. Pure token colours — the only
 * variable is `accent`, so every save re-lights the same room in its colour.
 */
export function voidBackdrop(accent: string): string {
  return [
    `radial-gradient(120% 88% at 50% -12%, ${withAlpha(accent, 0.16)} 0%, transparent 46%)`,
    `radial-gradient(78% 62% at 50% 30%, ${MC.haze} 0%, transparent 70%)`,
    `radial-gradient(140% 70% at 50% 118%, ${withAlpha(accent, 0.1)} 0%, transparent 55%)`,
    `linear-gradient(180deg, ${MC.abyss} 0%, ${MC.ink} 42%, ${MC.ink} 70%, ${MC.abyss} 100%)`,
  ].join(', ')
}

// ---- Ink ramp (spec §3): cool-cast ladder, #08090C → #262A33 -------------
/**
 * Depth on the select screen is built from lightness LAYERS, not shadows. Every
 * dark surface reads through this five-step cool-cast ramp (hue ≈ 250, ~+4–6%
 * lightness per step): the page floor (`950`/`900`), the mid-stage atmospheric
 * lift (`850`), and raised stock — the active slot card (`700`) and the
 * brightest ink hairline stock (`600`). `900` is the base plane and equals
 * `MC.ink`; the whole ramp reads as one continuous void behind the canvases.
 */
export const INK = {
  950: '#08090c', // abyss — screen edges, far floor
  900: '#0d0e14', // base plane (=== MC.ink)
  850: '#101219', // mid-stage atmospheric lift
  700: '#1c1f26', // raised stock — the active slot card
  600: '#262a33', // top of ramp — brightest ink hairline stock
} as const

// ---- Motion tokens (spec §3) ---------------------------------------------
/**
 * Two eases and the shared timings the select screen animates on. Entrances
 * scale `startScale`→1 with a ≤`rise`px lift and a ~`stagger` cascade; the
 * save-select signature transition (slot expand + title swap + hero atmosphere)
 * shares ONE `select` timing on the `move` ease. Reduced motion uses none of
 * this — opacity-only or instant. Both string (CSS) and array (framer-motion)
 * forms of each curve are exported so consumers never hand-write a bezier.
 */
export const MOTION = {
  easeEntrance: 'cubic-bezier(0.19, 1, 0.22, 1)',
  easeMove: 'cubic-bezier(0.86, 0, 0.07, 1)',
  easeEntranceArr: [0.19, 1, 0.22, 1] as [number, number, number, number],
  easeMoveArr: [0.86, 0, 0.07, 1] as [number, number, number, number],
  /** Signature select transition — one shared timing, seconds. */
  select: 0.28,
  /** Entrance reveal duration + inter-item stagger, seconds. */
  reveal: 0.42,
  stagger: 0.05,
  /** Entrance rise distance (px) and start scale. */
  rise: 14,
  startScale: 0.98,
} as const

// ---- Grain (spec §3): one full-page feTurbulence layer --------------------
/**
 * Recipe for the single page-wide grain field that kills banding and the
 * flat-black tell. Consumed by `grain.tsx` (an `feTurbulence` filter rendered
 * at low opacity in `overlay` blend). Tuning lives here so the layer stays a
 * pure token consumer.
 */
export const GRAIN = {
  baseFrequency: 0.85,
  numOctaves: 2,
  opacity: 0.05,
  blendMode: 'overlay',
} as const

/** One paper hairline weight (spec §3: paper at 0.10–0.12 alpha). */
export const HAIRLINE = paperAlpha(0.11)
/** The dimmer divider weight used between resting rows. */
export const HAIRLINE_DIM = paperAlpha(0.07)

/**
 * The base plane behind everything on the select screen — the vertical ink
 * ramp, no accent. Set as the `<main>` background so every other layer (accent
 * atmosphere, title, figure, slots) composites over one continuous void.
 */
export function pageBackdrop(): string {
  return `linear-gradient(180deg, ${INK[950]} 0%, ${INK[900]} 40%, ${INK[900]} 68%, ${INK[950]} 100%)`
}

/**
 * The hero half's lit atmosphere, tinted by the active save's accent — the one
 * place the per-save accent finally owns real estate (spec §1/§3). An accent
 * wash falls from above, a cool `INK-850` radial lifts the mid-stage out of the
 * abyss, and an accent ground-glow rises from the floor. All layers fall off to
 * transparent so this composites OVER `pageBackdrop` inside the hero box (which
 * is the left half on desktop, the top block on mobile); the only variable is
 * `accent`, so each save re-lights the same room in its own colour.
 */
export function heroAtmosphere(accent: string): string {
  return [
    `radial-gradient(96% 72% at 50% -6%, ${withAlpha(accent, 0.17)} 0%, transparent 48%)`,
    `radial-gradient(72% 56% at 50% 32%, ${withAlpha(MC.haze, 0.9)} 0%, transparent 72%)`,
    `radial-gradient(130% 72% at 50% 114%, ${withAlpha(accent, 0.13)} 0%, transparent 56%)`,
  ].join(', ')
}

/** SVG path data for the four glyph shapes in a 24x24 viewBox, stroke-style. */
export const GLYPH_PATHS: Record<GlyphName, string> = {
  triangle: 'M12 4 L21 19 L3 19 Z',
  circle: 'M12 4 a8 8 0 1 0 0.001 0 Z',
  cross: 'M5 5 L19 19 M19 5 L5 19',
  square: 'M5 5 H19 V19 H5 Z',
}

// ---- Component: per-role type scale --------------------------------------
export const TYPE = {
  display: 'clamp(3.5rem, 11vw, 8.5rem)', // Anton, uppercase, line-height 0.92
  h2: 'clamp(2rem, 5vw, 3.5rem)',
  label: '0.75rem', // mono, letter-spacing 0.2em, uppercase
  body: '1.0625rem', // Space Grotesk, line-height 1.6
} as const

/** Rail save-label sticker paper — brighter than MC.paper so the printed
 *  sticker reads as fresh label stock against the grey shell. */
export const STICKER_PAPER = {
  top: '#f2f0ea', // gradient top of the sticker field
  field: '#f6f5f1', // flat label area
} as const
