/**
 * Round 9 (Task 30) — the SINGLE source of truth for every live-tunable clay dial.
 *
 * Aram wants dials on the page to feel out "how rough" the clay should read. This
 * module owns each dial's { value, default, min, max, step, label, group, cls} and a
 * tiny store; the ?tune=1 overlay panel reads/writes it and every consumer imports
 * the SAME `DIALS` object so a panel write actually takes effect (no forked constant,
 * no drift between the panel default and the shipped value).
 *
 * Two update classes:
 *  - 'live'   — read per frame (shader uniforms). A slider drag applies instantly.
 *  - 'rebake' — baked into geometry/colour (the bake loop reads them). Changing one
 *               debounces ~400 ms, then bumps `bakeVersion()` so the planet's bake
 *               `useMemo` re-runs, disposes the old geometry and re-inits the morphs.
 *
 * Zero imports from the scene — a leaf module (no TDZ risk in the stage↔planet cycle),
 * safe for boil-material.ts / field-clay.ts / planet.tsx to import.
 *
 * DEFAULTS ARE LOAD-BEARING: each one equals the constant it replaced EXACTLY, so with
 * ?tune absent (nothing writes) the bake output is byte-for-byte today's. The unit test
 * pins every default against its legacy literal.
 */

export type DialClass = 'live' | 'rebake'

export type Dial = {
  value: number
  readonly default: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly label: string
  readonly group: string
  readonly cls: DialClass
}

function dial(d: Omit<Dial, 'value'>): Dial {
  return { ...d, value: d.default }
}

/**
 * Every dial, in panel render order. Grouped by `group` header. Task 31 drops a
 * "water" group in here and the panel renders it with no panel-code change.
 */
export const DIALS = {
  // boil (live) — the stepped normal-tilt shimmer. Amplitude 0 = off (Aram's verdict).
  boilAmp: dial({ default: 0, min: 0, max: 0.15, step: 0.001, label: 'amplitude', group: 'boil', cls: 'live' }),
  boilFps: dial({ default: 10, min: 1, max: 24, step: 1, label: 'fps', group: 'boil', cls: 'live' }),

  // fields (rebake) — the thumbiness colour + normal channels on open ground.
  mottleMacro: dial({ default: 0.035, min: 0, max: 0.2, step: 0.001, label: 'mottle macro', group: 'fields', cls: 'rebake' }),
  mottleMicro: dial({ default: 0.015, min: 0, max: 0.2, step: 0.001, label: 'mottle micro', group: 'fields', cls: 'rebake' }),
  mottleSaturation: dial({ default: 0.2, min: 0, max: 0.6, step: 0.005, label: 'saturation drift', group: 'fields', cls: 'rebake' }),
  veinDensity: dial({ default: 0.12, min: 0, max: 0.5, step: 0.005, label: 'vein density', group: 'fields', cls: 'rebake' }),
  grimeDensity: dial({ default: 0.1, min: 0, max: 0.4, step: 0.005, label: 'grime density', group: 'fields', cls: 'rebake' }),
  // Round-9 verdict: terminator dither reads as flickering shadows (same family as the
  // boil) — DEFAULT 0 (off). The dial stays so it remains explorable.
  terminatorDither: dial({ default: 0, min: 0, max: 0.1, step: 0.001, label: 'terminator dither', group: 'fields', cls: 'rebake' }),
  // Round-9 continued (Task 33) — TERRAIN flow field. The flow-aligned streak colour
  // (Task 32's water lever) extended onto the LAND so Aram can judge the flow effect at
  // scale. `terrainFlowStrength` = how much poleward/around-sphere swirl blends into the
  // downslope drainage direction; `terrainFlowAlign` = how strongly the field streak
  // colour follows that flow (0 = isotropic — the legacy mottle, so it can be dialled
  // back to today's look). Magnitude reuses the existing mottle amps, so turning mottle
  // down shrinks the flow streak too. Colour-only — no displacement (the spine contact
  // analytic bound is untouched); feathered to 0 on the girl's lane so her path never
  // stripes.
  terrainFlowStrength: dial({ default: 0.5, min: 0, max: 1.5, step: 0.05, label: 'terrain flow strength', group: 'fields', cls: 'rebake' }),
  terrainFlowAlign: dial({ default: 0.6, min: 0, max: 1, step: 0.02, label: 'terrain flow align', group: 'fields', cls: 'rebake' }),

  // dents (rebake) — the off-lane press-hollows + their baked AO. Round-9 verdict: Aram
  // likes the HIGHER settings — defaults baked to ~75% of the prior max and the maxes
  // ~doubled for headroom. Capture-gated so the fields read pressed, not gloomy; the
  // off-lane gate lives in fieldDents (0 on the spine band at ANY depth, so the contact
  // budget never moves — proven at the new max in scan-task23).
  dentDepth: dial({ default: 0.0375, min: 0, max: 0.1, step: 0.001, label: 'press-dent depth', group: 'dents', cls: 'rebake' }),
  dentAO: dial({ default: 0.3, min: 0, max: 0.8, step: 0.005, label: 'dent AO strength', group: 'dents', cls: 'rebake' }),

  // water (rebake) — Task 31 clay-water genart (clay-noise.ts / water-clay.ts). Every
  // param bakes into the water geometry/colour/normals, so all are rebake-class; the
  // debounced path re-runs the water bake and re-inits its morphs. Defaults === the
  // WATER_DEFAULTS literal in water-clay.ts (pinned by the tunables test). Kept literal
  // so this stays a zero-import leaf (no TDZ risk in the stage↔planet cycle).
  // Round-9 verdict: water dials were hard to judge (visible change too small, ranges too
  // narrow). Maxes ~doubled where plausible so slider moves are VISIBLE; every extended
  // max is re-proven safe (shoreline + all six deck clearances) in scan-task31, whose
  // MAXP mirrors these maxes BY CONSTRUCTION (it imports DIALS). pocketTint default 0.8
  // is Aram's kept value.
  waterPathWarp: dial({ default: 0.9, min: 0, max: 3.5, step: 0.02, label: 'path warp', group: 'water', cls: 'rebake' }),
  waterPathStretch: dial({ default: 2.5, min: 1, max: 10, step: 0.1, label: 'path stretch', group: 'water', cls: 'rebake' }),
  waterPathDepth: dial({ default: 0.014, min: 0, max: 0.06, step: 0.001, label: 'path depth', group: 'water', cls: 'rebake' }),
  waterPocketTint: dial({ default: 0.8, min: 0, max: 1, step: 0.01, label: 'pocket tint', group: 'water', cls: 'rebake' }),
  waterReliefInward: dial({ default: 0.04, min: 0, max: 0.1, step: 0.001, label: 'relief inward', group: 'water', cls: 'rebake' }),
  waterReliefOutward: dial({ default: 0.01, min: 0, max: 0.04, step: 0.0005, label: 'relief outward', group: 'water', cls: 'rebake' }),
  waterRidgeSharp: dial({ default: 1.4, min: 0.3, max: 5, step: 0.05, label: 'ridge sharpness', group: 'water', cls: 'rebake' }),
  waterOctaves: dial({ default: 4, min: 1, max: 6, step: 1, label: 'relief octaves', group: 'water', cls: 'rebake' }),
  waterNormalRough: dial({ default: 0.42, min: 0, max: 1, step: 0.01, label: 'normal roughness', group: 'water', cls: 'rebake' }),
  // Flow-aligned streak COLOUR (Task 32): the streak daubs run along an authored drainage
  // flow field so they read as tool-dragged flowing runs. `flow strength` = around-sphere
  // swirl; `flow alignment` = how strongly the streaks follow the flow (0 = isotropic).
  waterFlowStrength: dial({ default: 0.4, min: 0, max: 1.5, step: 0.05, label: 'flow strength', group: 'water', cls: 'rebake' }),
  waterFlowAlign: dial({ default: 0.85, min: 0, max: 1, step: 0.02, label: 'flow alignment', group: 'water', cls: 'rebake' }),
  // Round-9 continued (Task 33) — WATER ALTITUDE. Claymation water is a proud slab flush
  // with the land, not a sunken pool. This raises the RENDER water-sphere radius above the
  // geography waterline (WATER_LEVEL, the wetness classifier in biomes.ts, is UNTOUCHED —
  // lane dryness / crossings-wet / anchors-dry are unchanged; the rise is render-only). At
  // dial 0 the water sits at WATER_LEVEL (today's recessed look); the MAX (0.008 of R) lifts
  // it flush-to-slightly-proud of the beach shore. The max is CLAMPED by the girl's own dry
  // lane: her lowest lane point sits at 0.9831R (longitude ≈1.7, lap 2), so 0.972+0.008=0.980R
  // leaves her ~0.003R of dry path; the six bridge decks buy their headroom from the raised
  // DECK_RISE (0.13→0.16). Re-proven at MAX in scan-task33 / scan-task31. Rebake-class (the
  // water bake reads it once), default 0 keeps ?tune-absent byte-identical.
  waterRise: dial({ default: 0, min: 0, max: 0.008, step: 0.0005, label: 'water altitude', group: 'water', cls: 'rebake' }),
} satisfies Record<string, Dial>

export type DialKey = keyof typeof DIALS
/** Dial keys in declaration (panel render) order. */
export const DIAL_KEYS = Object.keys(DIALS) as DialKey[]

// ── store ──────────────────────────────────────────────────────────────────────
const REBAKE_DEBOUNCE_MS = 400

let revision = 0 // bumps on EVERY change (drives panel re-render)
let version = 0 // bumps only when a rebake settles (drives the bake useMemo)
let rebaking = false
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function notify(): void {
  revision++
  for (const l of listeners) l()
}

/** Subscribe to any dial change (panel) or a settled rebake (bake). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Monotonic tick bumped on every change — a useSyncExternalStore snapshot for the panel. */
export function revisionSnapshot(): number {
  return revision
}

/** Monotonic bake generation — bumped AFTER a rebake-class change settles (debounced).
 *  The planet bake depends on this; a bump re-runs the bake and re-inits the morphs. */
export function bakeVersion(): number {
  return version
}

/** True while a rebake-class edit is waiting out its debounce (the panel shows a badge). */
export function isRebaking(): boolean {
  return rebaking
}

function scheduleRebake(): void {
  rebaking = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    rebaking = false
    version++
    notify()
  }, REBAKE_DEBOUNCE_MS)
}

/** Set a dial, clamped to its range. Live dials apply on the next frame; rebake dials
 *  debounce then bump `bakeVersion()`. No-ops (and skips the rebake) when unchanged. */
export function setDial(key: DialKey, raw: number): void {
  if (!Number.isFinite(raw)) return // defensive: a range input never emits NaN
  const d = DIALS[key]
  const clamped = Math.min(d.max, Math.max(d.min, raw))
  if (clamped === d.value) return
  d.value = clamped
  if (d.cls === 'rebake') scheduleRebake()
  notify()
}

/** Restore every dial to its default and force one rebake so geometry returns to stock. */
export function resetDials(): void {
  for (const k of DIAL_KEYS) DIALS[k].value = DIALS[k].default
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  rebaking = false
  version++
  notify()
}

/** The current non-default dial values, keyed by dial name — what "copy settings" exports. */
export function nonDefaultSettings(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of DIAL_KEYS) {
    const d = DIALS[k]
    if (d.value !== d.default) out[k] = d.value
  }
  return out
}

/** Whether the ?tune panel is enabled for this location. Pure — the gate lives here so
 *  it can be unit-tested without mounting the WebGL scene. */
export function isTuneEnabled(search: string): boolean {
  return new URLSearchParams(search).get('tune') === '1'
}
