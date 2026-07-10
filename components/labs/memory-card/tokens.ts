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
export const MC = {
  ink: '#101014',
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

/** Paper at reduced opacity — the sanctioned way to dim light-on-ink text/rules. */
export function paperAlpha(a: number): string {
  return `rgba(${hexToRgb(MC.paper)},${a})`
}

/** Ink at reduced opacity — the sanctioned way to dim dark-on-paper text/rules. */
export function inkAlpha(a: number): string {
  return `rgba(${hexToRgb(MC.ink)},${a})`
}

/** Section → accent (hero triangle, work circle, skills cross, about square, contact triangle). */
export const SECTION_ACCENT: Record<'hero' | 'work' | 'skills' | 'about' | 'contact', GlyphName> =
  {
    hero: 'triangle',
    work: 'circle',
    skills: 'cross',
    about: 'square',
    contact: 'triangle',
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
