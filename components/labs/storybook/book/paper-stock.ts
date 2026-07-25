/**
 * Per-piece warm-kraft stock variation (D3, kraft-legibility package). Every
 * renderer's artless-face fallback (no baked art yet) used to read as
 * exactly two shared tints — PAPER_TINT / PAPER_SHADE_TINT, duplicated in
 * popup-box-layer.tsx, popup-platform-layer.tsx, popup-tabpiece-layer.tsx
 * and popup-anatomy-layers.tsx. Fine for one piece alone, but during a
 * chapter turn several half-folded artless pieces stand at once and, being
 * literally the same two colors, they read as a single unreadable mass (the
 * "mid-turn kraft tangle", D-G3 audit + D2 ledger).
 *
 * `kraftTints` answers with one pair from a small curated family of warm
 * stock tones instead of the fixed pair — a deterministic hash of the
 * piece's own layer id, so the same piece always gets the same stock (no
 * per-frame flicker) and neighbors on a spread are likely, not guaranteed,
 * to land on different members. The family stays in the SAME hue
 * neighborhood as the original pair (kraft/tan/amber, ~20-48deg) and the
 * same lit->shade relationship (a touch less saturated, a step darker) —
 * the goal is SEPARABILITY between adjacent pieces, not a confetti box of
 * unrelated colors.
 */

export type KraftTint = {
  /** The lit sibling — replaces the shared PAPER_TINT fallback. */
  lit: string
  /** The shaded sibling (the panel turned away from the key light) —
   *  replaces the shared PAPER_SHADE_TINT fallback. */
  shade: string
  /** A paler core sibling for cut-edge hairlines on artless faces only — the
   *  die-cut exposes the sheet's uninked core, so this jumps LIGHTER than
   *  `lit`/`shade` (not darker); separation from a same-family neighbor
   *  mid-turn now comes from the lightness jump, not darkness (D3
   *  edge-legibility package). */
  edge: string
}

type StockHsl = { readonly h: number; readonly s: number; readonly l: number }

// One member ("kraft classic") reproduces the original pair almost exactly
// (h41/s0.40/l0.745 -> #d8c8a4, one off-by-one-bit from the literal
// original) so existing captures don't jump; the rest are adjacent hue/
// saturation/lightness nudges named for what they read as.
const FAMILY_LIT: readonly StockHsl[] = [
  { h: 41, s: 0.4, l: 0.745 }, // kraft classic
  { h: 48, s: 0.32, l: 0.76 }, // cooler oat
  { h: 32, s: 0.48, l: 0.7 }, // warmer amber
  { h: 38, s: 0.22, l: 0.7 }, // dustier tan
  { h: 20, s: 0.3, l: 0.72 }, // rosier kraft
  { h: 45, s: 0.28, l: 0.82 }, // pale cream
  { h: 35, s: 0.38, l: 0.66 }, // deeper kraft
]

// Deltas measured off the original pair's own lit->shade step (~ -9% sat,
// -10% light); the edge sibling jumps lighter and slightly less saturated —
// the pale core, not a hairline shadow.
const SHADE_DELTA = { s: -0.09, l: -0.1 }
const EDGE_DELTA = { s: -0.12, l: 0.15 }

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** h in degrees [0,360), s/l in [0,1]. Standard HSL->RGB, hex-packed. */
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

function stockPair(hsl: StockHsl): KraftTint {
  return {
    lit: hslToHex(hsl.h, hsl.s, hsl.l),
    shade: hslToHex(hsl.h, clamp01(hsl.s + SHADE_DELTA.s), clamp01(hsl.l + SHADE_DELTA.l)),
    edge: hslToHex(hsl.h, clamp01(hsl.s + EDGE_DELTA.s), clamp01(hsl.l + EDGE_DELTA.l)),
  }
}

const FAMILY: readonly KraftTint[] = FAMILY_LIT.map(stockPair)

/** Tiny deterministic string hash (djb2 variant) — same shape as
 *  use-layer-texture.ts's `hashLayerId`, so the same layer id always seeds
 *  the same stock and different ids scatter reliably across the family. */
function hashLayerId(id: string): number {
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/** The warm-kraft stock a given piece prints on its artless faces: a stable,
 *  piece-specific `{ lit, shade, edge }` triple picked from the curated
 *  family above. */
export function kraftTints(layerId: string): KraftTint {
  return FAMILY[hashLayerId(layerId) % FAMILY.length]
}
