/**
 * THE LOOK TABLE (Task 130) — the three numbers the journey's look upgrade rides on, in one
 * module, readable live.
 *
 * Aram, after T127/T128: *"I like this ambient lighting of the desk so much more on the planet"*,
 * *"can we double the pixels during the whole journey"*, and — the constraint that shapes this
 * file — *"I would like to have the result in the website, but make it so we can reverse it."*
 *
 * Three rows, and each one is a decision that was measured rather than typed:
 *
 *  - `ambient`     the journey's fill. T127's L1 copied the desk's 1.62 globally and muddied three
 *                  biomes; its L4 (1.00) was flattered-or-neutral everywhere. 1.00 is the shipped
 *                  rung and 1.62 — the desk's own `STUDIO_AMBIENT_INTENSITY` — is the top of the
 *                  range, so Aram can walk it all the way to the number he asked for and see what
 *                  T127 measured. The floor is 0.42, the rig as it shipped before this round.
 *  - `occStrength` how far the baked terrain occlusion modulates the toon-lit ground (T128). The
 *                  atlas is pre-shaped (see `planet-occ-contract.ts`), so 1 is the authored look
 *                  and this row is a fader to 0, not a shaping knob.
 *  - `journeyDpr`  the floor under the journey's pixel ratio. T81 scoped the ending's floor of 2
 *                  to the ending; T127 §3 L5 measured that on a 1× display the ending's crispness
 *                  is a large part of what Aram is seeing, and he asked for it everywhere.
 *
 * ── WHY A TABLE AND NOT THREE CONSTANTS ───────────────────────────────────────────────────────
 *
 * Every row carries its own range, step and label, in the SAME shape as `tunables.ts`'s `Dial`.
 * That is not decoration: it means a slider can be bound to a row without the panel knowing
 * anything about what the row means, exactly as the ?tune panel already does for the clay dials.
 * A stitch task adds the sliders; nothing in this file has to change when it does.
 *
 * ── WHY IT COSTS READERS NOTHING ──────────────────────────────────────────────────────────────
 *
 * A row read is a property read — the same cost the frame loop already pays reading a constant —
 * and with no override applied every `value` IS its `default`. The override reader runs once at
 * module load, and its first statement is the ?tune gate, so a visitor without the flag pays one
 * `URLSearchParams` construction on a string that is almost always empty and nothing else. No
 * storage read, no parse, no listener.
 *
 * Zero imports, deliberately — same reason as `tunables.ts`. This is a leaf that `boil-material`,
 * `planet.tsx`, `biome-atmosphere` and `ending-dpr` all sit above, and any import here would put
 * a cycle through the scene graph's most tangled corner. The consequence is that the `ambient`
 * row's range is written as two literals rather than imported from `biome-atmosphere.tsx`; they
 * are pinned against those constants in `look-table.test.ts`, which is where the codebase already
 * puts that promise.
 */

export type LookRow = {
  /** What the frame loop reads. Starts at `default`; a panel or a ?tune override moves it. */
  value: number
  readonly default: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly label: string
  readonly group: string
}

function row(r: Omit<LookRow, 'value'>): LookRow {
  return { ...r, value: r.default }
}

export const LOOK = {
  /**
   * The journey's ambient fill. Feeds only the JOURNEY end of
   * `studioLitIntensity(base, studio, lights)`, so at the money shot (`lights = 1`) the desk
   * renders its approved 1.62 whatever this row says — which is what makes the desk's pixel hash
   * hold at every setting of this dial rather than only at the default.
   *
   * min: the pre-T130 rig. max: `STUDIO_AMBIENT_INTENSITY`, the desk's own fill.
   */
  ambient: row({
    default: 1.0,
    min: 0.42,
    max: 1.62,
    step: 0.01,
    label: 'ambient fill',
    group: 'look',
  }),

  /**
   * How far the baked occlusion modulates the terrain, 0..1. The runtime multiplies by
   * `occStrength · (1 − studioLights)`, so this is also 0 at the money shot by construction.
   */
  occStrength: row({
    default: 1,
    min: 0,
    max: 1,
    step: 0.02,
    label: 'terrain occlusion',
    group: 'look',
  }),

  /**
   * The floor under the journey's device pixel ratio. 1 = the pre-T130 behaviour exactly (take
   * whatever the device asks for); 2 = the ending's floor, extended to the whole lab. Stepped by
   * 1 because the Canvas ceiling is 2 and there is nothing between: a fractional floor would
   * reallocate the drawing buffer to a size no display asked for.
   */
  journeyDpr: row({
    default: 2,
    min: 1,
    max: 2,
    step: 1,
    label: 'journey pixel ratio',
    group: 'look',
  }),
} satisfies Record<string, LookRow>

export type LookKey = keyof typeof LOOK

/** Panel render order. */
export const LOOK_KEYS = Object.keys(LOOK) as LookKey[]

// ── store ──────────────────────────────────────────────────────────────────────────────────────
//
// Every row is LIVE — read per frame by a uniform write or a light intensity — so there is no
// rebake class here and no debounce. A write takes effect on the next frame.

let revision = 0
const listeners = new Set<() => void>()

/** Subscribe to any row change. Returns the unsubscribe. */
export function subscribeLook(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Monotonic tick bumped on every change — a `useSyncExternalStore` snapshot for a panel. */
export function lookRevision(): number {
  return revision
}

/**
 * Set a row, clamped to its range. Persists when ?tune is live, so a slider Aram settles survives
 * the reload he takes the next capture with; silent otherwise, because a reader must never carry
 * a developer's session in their storage.
 */
export function setLook(key: LookKey, raw: number): void {
  if (!Number.isFinite(raw)) return
  const r = LOOK[key]
  const clamped = Math.min(r.max, Math.max(r.min, raw))
  if (clamped === r.value) return
  r.value = clamped
  persist()
  revision++
  for (const l of listeners) l()
}

/** Restore every row to its default (and clear the persisted set). */
export function resetLook(): void {
  for (const k of LOOK_KEYS) LOOK[k].value = LOOK[k].default
  persist()
  revision++
  for (const l of listeners) l()
}

/** The rows that are not at their default — what a "copy settings" button exports. */
export function nonDefaultLook(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of LOOK_KEYS) if (LOOK[k].value !== LOOK[k].default) out[k] = LOOK[k].value
  return out
}

// ── overrides ──────────────────────────────────────────────────────────────────────────────────

/** Where a settled set survives a reload. Namespaced so it cannot collide with a pace table's. */
export const LOOK_STORAGE_KEY = 'sw-look-table'

/**
 * The ?tune gate, restated rather than imported for the leaf reason in the header. `tunables.ts`
 * owns the shipped panel's copy of this and `look-table.test.ts` pins the two together, so the
 * look rows can never become adjustable under a flag the panel does not answer to.
 */
export function isLookTuneEnabled(search: string): boolean {
  return new URLSearchParams(search).get('tune') === '1'
}

/**
 * The rows a query string asks for, as a plain record — pure, so the parse is testable without a
 * location. Only reads keys that exist, only accepts finite numbers, and returns nothing at all
 * unless ?tune=1 is present: a stray `?ambient=1.6` on a link someone shares must render the
 * shipped look, not a half-remembered experiment.
 */
export function parseLookOverrides(search: string): Partial<Record<LookKey, number>> {
  const out: Partial<Record<LookKey, number>> = {}
  if (!isLookTuneEnabled(search)) return out
  const q = new URLSearchParams(search)
  for (const k of LOOK_KEYS) {
    const raw = q.get(k)
    if (raw === null) continue
    const n = Number(raw)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

/** The rows a persisted blob asks for. Tolerates anything — a hand-edited entry must not throw. */
export function parseLookStorage(blob: string | null): Partial<Record<LookKey, number>> {
  const out: Partial<Record<LookKey, number>> = {}
  if (!blob) return out
  let parsed: unknown
  try {
    parsed = JSON.parse(blob)
  } catch {
    return out
  }
  if (typeof parsed !== 'object' || parsed === null) return out
  const rec = parsed as Record<string, unknown>
  for (const k of LOOK_KEYS) {
    const v = rec[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem'>

let store: MinimalStorage | null = null

function persist(): void {
  if (!store) return
  try {
    store.setItem(LOOK_STORAGE_KEY, JSON.stringify(nonDefaultLook()))
  } catch {
    // A private-mode quota refusal must not take the scene down with it.
  }
}

/**
 * Apply overrides once, from a query string and (only then) from storage. The query wins, so a
 * capture run's explicit `&ambient=1.62` is never quietly overruled by whatever the last session
 * left behind.
 *
 * Exported with its inputs injected so the whole path is unit-testable — the module-scope call
 * below is the only place that touches `window`.
 */
export function applyLookOverrides(search: string, storage: MinimalStorage | null): void {
  const enabled = isLookTuneEnabled(search)
  // The binding is taken from the gate rather than from the argument, so a location without the
  // flag positively DISABLES persistence rather than merely declining to enable it.
  store = enabled ? storage : null
  if (!enabled) return
  let stored: Partial<Record<LookKey, number>> = {}
  if (storage) {
    try {
      stored = parseLookStorage(storage.getItem(LOOK_STORAGE_KEY))
    } catch {
      stored = {}
    }
  }
  const wanted = { ...stored, ...parseLookOverrides(search) }
  for (const k of LOOK_KEYS) {
    const v = wanted[k]
    if (v !== undefined) setLook(k, v)
  }
}

if (typeof window !== 'undefined') {
  applyLookOverrides(window.location.search, window.localStorage)
}
