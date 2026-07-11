/**
 * Per-save visual identity — the pure mapping from a save to *which* label
 * layout it wears. Kept free of three/canvas/fonts so the mapping is
 * unit-testable on its own; the heavy canvas painters in `label-texture.ts`
 * consume what it returns.
 *
 * The era reference: a real PS1 card was a junk-drawer of distinct objects —
 * a formal bank-form label on one, a messaging-app sticker on the next, an
 * app-store badge on a third — so each project save gets a different composition
 * (same paper/ink/token language), and the system saves get quieter system-form
 * variants that keep the project trio prominent.
 *
 * (Shell tint + physical wear are owned by the Blender asset pipeline, not
 * runtime — this module is labels only.)
 */

import type { SaveKind } from '../save-select/saves'

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
