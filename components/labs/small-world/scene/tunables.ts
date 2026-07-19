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
  terminatorDither: dial({ default: 0.02, min: 0, max: 0.1, step: 0.001, label: 'terminator dither', group: 'fields', cls: 'rebake' }),

  // dents (rebake) — the off-lane press-hollows + their baked AO.
  dentDepth: dial({ default: 0.012, min: 0, max: 0.05, step: 0.001, label: 'press-dent depth', group: 'dents', cls: 'rebake' }),
  dentAO: dial({ default: 0.09, min: 0, max: 0.4, step: 0.005, label: 'dent AO strength', group: 'dents', cls: 'rebake' }),
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
