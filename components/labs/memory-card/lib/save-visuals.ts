/**
 * Per-save visual identity — the pure mapping from a save to *which* label
 * layout it wears and *what* seeds its wear. Kept free of three/canvas/fonts so
 * the mapping is unit-testable on its own (the determinism gate); the heavy
 * canvas painters in `label-texture.ts` and `card-wear.ts` consume what it
 * returns.
 *
 * The era reference: a real PS1 card was a junk-drawer of distinct objects —
 * a formal bank-form label on one, a messaging-app sticker on the next, an
 * app-store badge on a third — so each project save gets a different composition
 * (same paper/ink/token language), and the system saves get quieter system-form
 * variants that keep the project trio prominent.
 */

import type { SaveKind } from '../save-select/saves'
import { hashSeed, mulberry32 } from './mulberry'

export type SaveLabelVariant =
  | 'bankform' // formal ruled bank-form label
  | 'chat' // messaging-app sticker, side accent bar + reply bubble
  | 'appbadge' // app-store badge, icon tile + star row
  | 'sysdata' // quiet system read-out
  | 'syslog' // quiet ledger / log rows
  | 'sysprompt' // quiet save-dialog prompt

/** System kinds map to their one quiet variant; projects cycle three loud ones. */
const SYSTEM_VARIANT: Record<Exclude<SaveKind, 'project'>, SaveLabelVariant> = {
  bio: 'sysdata',
  stack: 'syslog',
  contact: 'sysprompt',
}

const PROJECT_VARIANTS: SaveLabelVariant[] = ['bankform', 'chat', 'appbadge']

/**
 * Which label composition a save wears. Projects cycle the three loud layouts by
 * their position; each system kind has one fixed quiet layout.
 */
export function labelVariantFor(kind: SaveKind, index: number): SaveLabelVariant {
  if (kind !== 'project') return SYSTEM_VARIANT[kind]
  return PROJECT_VARIANTS[index % PROJECT_VARIANTS.length]
}

/** Stable per-save wear seed (from the slot id) for the mulberry32 wear stream. */
export function wearSeedFor(slot: string): number {
  return hashSeed(slot)
}

// ---- Wear profile (pure; the canvas painters in card-wear/label-texture read it)

export type WearProfile = {
  /** Overall edge-grime + scuff strength, 0..1 (drives every mark's alpha). */
  grime: number
  /** Which corner wears the heaviest scuff (0 = TL, 1 = TR, 2 = BR, 3 = BL). */
  scuffCorner: 0 | 1 | 2 | 3
  /** Radians — angle of the hairline scratch across the shell. */
  scratchAngle: number
  /** A faint hairline scratch is present. */
  hasScratch: boolean
  /** The ghost of a peeled-off older sticker is stuck to the plastic. */
  hasResidue: boolean
}

/**
 * Pure wear from a seed. The draw order of the mulberry stream is fixed so the
 * residue threshold lands the sticker-residue ghost on ~1–2 cards of a six-card
 * fan (verified for the shipped slot ids); tune the thresholds here, never at the
 * call site.
 */
export function wearProfile(seed: number): WearProfile {
  const rnd = mulberry32(seed)
  const grime = 0.32 + rnd() * 0.5
  const scuffCorner = Math.floor(rnd() * 4) as WearProfile['scuffCorner']
  const scratchAngle = -0.35 + rnd() * 0.7
  const hasScratch = rnd() > 0.45
  const hasResidue = rnd() > 0.68
  return { grime, scuffCorner, scratchAngle, hasScratch, hasResidue }
}
