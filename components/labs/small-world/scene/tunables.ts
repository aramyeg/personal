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
 *
 * Task 129 adds ?tune-gated localStorage persistence at the bottom of this file (see
 * `initPersistence`), so Aram's dial positions — pace above all — survive a reload
 * while he's tuning, without touching how a normal visitor's session behaves.
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
  // Hard torn biome boundaries (Task 38 — Aram rejected the green connective seams: "there
  // should be a hard rough terrain change, without a seam"). Two abutting wedges now meet like
  // two slabs of clay pressed together, each painting its full accent up to a shared boundary
  // CURVE. `boundaryWander` is how torn that curve is (rad of longitude the seam wanders along
  // latitude — 0 = a straight ruled meridian); `boundaryRidge` is the height (fraction of R) of
  // the pressed-clay lip welded onto the seam (0 = a truly hard colour switch with no
  // physicality, the brief's fallback; the crease-dark line rides the same profile). Both are
  // rebake-class (baked into geometry/colour) and variant-INVARIANT by construction — the seam
  // sits in the same place on both laps, so it never flips. Defaults = the shipped Task-38 look.
  boundaryWander: dial({ default: 0.035, min: 0, max: 0.09, step: 0.001, label: 'boundary wander', group: 'fields', cls: 'rebake' }),
  boundaryRidge: dial({ default: 0.018, min: 0, max: 0.05, step: 0.001, label: 'boundary ridge', group: 'fields', cls: 'rebake' }),

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
  // Round-9 continued (Task 33/34) — WATER ALTITUDE. Claymation water is a proud slab flush
  // with the land, not a sunken pool. This raises the RENDER water-sphere radius above the
  // geography waterline (WATER_LEVEL, the wetness classifier in biomes.ts, is UNTOUCHED —
  // lane dryness / crossings-wet / anchors-dry are unchanged; the rise is render-only). At
  // dial 0 the water sits at WATER_LEVEL (today's recessed look).
  //
  // TWO-TIER RANGE (Task 34 — Aram wants to PLAY with this one):
  //  • SAFE ≤ 0.008·R — flush-to-slightly-proud of the beach shore, PROVEN clear of the girl's
  //    dry lane (her band min ≈0.9825R, so 0.972+0.008=0.980R leaves ~0.003R of dry path) and
  //    every dry-bank anchor + all six bridge decks (raised DECK_RISE 0.13→0.16). This is the
  //    shippable-default region; scan-task33 asserts clearance at 0.008 (WATER_RISE_SAFE_MAX).
  //  • 0.008 → 0.03·R (this slider max) — VISUAL EXPLORATION only. Past ~0.008 the risen slab
  //    visibly laps the girl's path and can swallow shore props; that is EXPECTED and accepted
  //    for a tuning dial (never the shipped default — default stays 0). Not proof territory:
  //    the bench captures what it looks like, it does not assert it stays clear.
  // Rebake-class (the water bake reads it once), default 0 keeps ?tune-absent byte-identical.
  waterRise: dial({ default: 0, min: 0, max: 0.03, step: 0.0005, label: 'water altitude (safe ≤0.008)', group: 'water', cls: 'rebake' }),
  // Task 40 — icy winter lake. How strongly the B2 winter pond (biomes.B2_FROZEN) reads
  // as solid ice: the ice colour (pale sheet + snow rim + crack veins) and the sheet
  // flattening are both scaled by this within the pond footprint mask (iceFootprint), so
  // 0 = the plain clay-water pond and 1 = full ice. Default 1 (the shipped icy look — this
  // IS the new intended state of the small lake). Rebake-class (the water bake reads it) and
  // footprint-masked, so it only ever touches that one pond. Purely variant-B paint + a
  // localized flatten of the shared sphere; nothing outside the footprint moves.
  waterIceAmount: dial({ default: 1, min: 0, max: 1, step: 0.02, label: 'winter lake ice', group: 'water', cls: 'rebake' }),

  // Task 49 — the canyon geysers. Both are LIVE (read per frame by the plume render in
  // canyon.tsx — the plume is a prop scaled by the rotation-driven eruption cycle, NOT baked
  // geometry), so a slider drag applies instantly. `geyserAmp` multiplies the erupting plume's
  // full height (0 = the geysers rest as bubbling pools with no jet); `geyserPeriod` is how many
  // radians of scroll-rotation one eruption cycle spans (larger = slower, statelier eruptions).
  // Defaults are the shipped look. The A/B look-dev (deep canyon vs mountain canyon) is a
  // separate capture-time flag (biomes.CANYON_MODE), not a live dial — it rebakes geometry.
  geyserAmp: dial({ default: 1, min: 0, max: 1.6, step: 0.02, label: 'geyser plume height', group: 'canyon', cls: 'live' }),
  geyserPeriod: dial({ default: 0.7, min: 0.2, max: 2, step: 0.05, label: 'geyser eruption period', group: 'canyon', cls: 'live' }),

  // Task 129 — THE PACE TABLE's dials. Aram: "I suggest having some controls so I can
  // pick the speed of each section as well so I can make sure I like the values."
  //
  // These are the only dials in this store that are not about how the clay LOOKS, and
  // they are here rather than in a store of their own for one reason: the panel already
  // renders whatever groups it finds, so a pace group costs no panel code (the header
  // above promised exactly that of Task 31's water group, and it held). `pace-table.ts`
  // reads `.value` per frame, so a drag retimes the story on the next frame with no
  // rebuild and no remount.
  //
  // Two units, and the split is the table's own: TRAVEL, ANIMALS and the ending WALK are
  // authored as her SURFACE SPEED in world units per second, because what they pace is a
  // girl walking (see pace-table's TRAVEL_SURFACE_SPEED — 2.2 is where Task 110 measured
  // the walk gear's dead band, so it is the fastest she is unambiguously walking).
  // Everything else is authored in SECONDS, because what it paces is a page drawing or a
  // body leaving the ground.
  paceTravelSpeed: dial({ default: 2.2, min: 0.6, max: 6, step: 0.05, label: 'travel — surface u/s', group: 'pace', cls: 'live' }),
  // 2.2 → 1.5 s is Aram's complaint answered, and 1.5 is not a taste: Task 109 bracketed
  // this span's content from below at ~1.5 s, under which the info page's count-up and its
  // burst stop reading as two events. So the notes are as fast as their own staging allows.
  paceNotesSeconds: dial({ default: 1.5, min: 0.4, max: 4, step: 0.05, label: 'notes — seconds', group: 'pace', cls: 'live' }),
  paceAnimalsSpeed: dial({ default: 2.2, min: 0.6, max: 6, step: 0.05, label: 'animals — surface u/s', group: 'pace', cls: 'live' }),
  // The turn is the one ending number with nothing to derive it from: she pivots on the
  // spot, so there is no arc and no stride to solve against. Bracketed by eye instead —
  // under ~0.4 s the about-face reads as a flinch, over ~1.2 s it reads as hesitation.
  paceTurnSeconds: dial({ default: 0.7, min: 0.2, max: 2.5, step: 0.05, label: 'ending turn — seconds', group: 'pace', cls: 'live' }),
  paceWalkSpeed: dial({ default: 2.2, min: 0.6, max: 6, step: 0.05, label: 'ending walk — surface u/s', group: 'pace', cls: 'live' }),
  // Task 125's EXIT_JUMP_SECONDS, preserved exactly (bracket: 0.6 flinch / 1.4 sink).
  paceJumpSeconds: dial({ default: 0.9, min: 0.3, max: 2, step: 0.05, label: 'ending jump — seconds', group: 'pace', cls: 'live' }),
  // How much faster a declined note runs, as a multiple of the notes rate. Floored at 1 by
  // `fastForwardFactor` so the fast path can never be the slow one.
  paceFastForward: dial({ default: 3.5, min: 1, max: 10, step: 0.1, label: 'fast-forward — ×rate', group: 'pace', cls: 'live' }),
  // Task 125's CARRY_IDLE_SECONDS — how long input must be quiet before a floor engages.
  paceCarryGrace: dial({ default: 0.14, min: 0.04, max: 0.8, step: 0.01, label: 'carry grace — seconds', group: 'pace', cls: 'live' }),
} satisfies Record<string, Dial>

export type DialKey = keyof typeof DIALS
/** Dial keys in declaration (panel render) order. */
export const DIAL_KEYS = Object.keys(DIALS) as DialKey[]

/**
 * Task 47 (worker bake) — the by-value snapshot of every dial the LAND bake reads. The
 * bake runs in a Web Worker, whose module graph gets its OWN `DIALS` instance (always at
 * defaults — the panel writes only the main-thread store). So the bake must NOT read a live
 * store; instead the main thread snapshots these twelve values with `readLandDials()` and
 * passes the plain object into `bakeLandArrays` (threaded through paintVertex / fieldDents /
 * applyFieldMottle). Determinism is by-value: same snapshot ⇒ byte-identical arrays, whether
 * the bake runs on the worker or the synchronous fallback.
 *
 * These are exactly the dials the land bake consumes today: the boundary curve (wander/ridge),
 * the field press-dents (depth/AO), the terrain flow field (strength/align), the terminator
 * dither, and the field mottle channels (saturation/macro/micro/vein/grime). Water dials are
 * NOT here — the water bake stays on the main thread.
 */
export type LandDials = {
  dentDepth: number
  dentAO: number
  boundaryWander: number
  boundaryRidge: number
  terrainFlowAlign: number
  terrainFlowStrength: number
  terminatorDither: number
  mottleSaturation: number
  mottleMacro: number
  mottleMicro: number
  veinDensity: number
  grimeDensity: number
}

/** Snapshot the live values of every land-bake dial into a plain object (main thread only).
 *  Read once per bake dispatch so a rebake bakes the dials as they settled. */
export function readLandDials(): LandDials {
  return {
    dentDepth: DIALS.dentDepth.value,
    dentAO: DIALS.dentAO.value,
    boundaryWander: DIALS.boundaryWander.value,
    boundaryRidge: DIALS.boundaryRidge.value,
    terrainFlowAlign: DIALS.terrainFlowAlign.value,
    terrainFlowStrength: DIALS.terrainFlowStrength.value,
    terminatorDither: DIALS.terminatorDither.value,
    mottleSaturation: DIALS.mottleSaturation.value,
    mottleMacro: DIALS.mottleMacro.value,
    mottleMicro: DIALS.mottleMicro.value,
    veinDensity: DIALS.veinDensity.value,
    grimeDensity: DIALS.grimeDensity.value,
  }
}

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
  scheduleStorageWrite()
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
  clearStorageBlob()
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

// ── ?tune-gated localStorage persistence (Task 129) ─────────────────────────────
// Aram wants to leave the panel dialled in between reloads while he's iterating on
// pace. Every dial above lives only in memory by default — a normal visitor's page
// reload always starts from the shipped defaults, which is what keeps the lab
// byte-identical for them. Persistence is gated on the SAME pure `isTuneEnabled`
// check the panel itself is gated on: with ?tune absent, this module never reads or
// writes localStorage, so the shipped experience cannot regress by so much as a
// stray storage call.
const STORAGE_KEY = 'small-world:tune-dials:v1'
const STORAGE_DEBOUNCE_MS = 400 // same idiom as REBAKE_DEBOUNCE_MS above

let persistenceEnabled = false
let storageTimer: ReturnType<typeof setTimeout> | null = null

/** Best-effort localStorage read. Never throws — a private-mode/quota error or a
 *  corrupt/unparseable blob both come back as "nothing stored" rather than crash. */
function readStorageBlob(): unknown {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

/** Apply a stored blob onto DIALS, validating every entry: a key that isn't a
 *  current dial name (a retired dial in an old blob) is ignored; a non-number or
 *  non-finite value is ignored; every surviving value is clamped to ITS dial's
 *  CURRENT [min, max] rather than trusted, so a range narrowed since the blob was
 *  written is respected, not the stale one. */
function restoreFromStorage(): void {
  const blob = readStorageBlob()
  if (blob === null || typeof blob !== 'object') return
  let changed = false
  for (const [key, raw] of Object.entries(blob as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(DIALS, key)) continue
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const d = DIALS[key as DialKey]
    d.value = Math.min(d.max, Math.max(d.min, raw))
    changed = true
  }
  if (changed) notify()
}

/** Debounced localStorage write of the non-default values — same idiom as
 *  `scheduleRebake` above. Best-effort: a write failure (private mode, quota) is
 *  swallowed, because a dev panel must never be able to break the lab. */
function scheduleStorageWrite(): void {
  if (!persistenceEnabled) return
  if (storageTimer) clearTimeout(storageTimer)
  storageTimer = setTimeout(() => {
    storageTimer = null
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nonDefaultSettings()))
    } catch {
      // ignore — see header
    }
  }, STORAGE_DEBOUNCE_MS)
}

/** Drop the stored blob (and any pending debounced write) immediately. */
function clearStorageBlob(): void {
  if (storageTimer) {
    clearTimeout(storageTimer)
    storageTimer = null
  }
  if (!persistenceEnabled) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore — see header
  }
}

/**
 * Arm (or disarm) ?tune-gated persistence and, if armed, restore any stored dial
 * values immediately and synchronously.
 *
 * IT IS NOT SELF-INVOKED, and that is a correction made against a measured
 * production failure rather than a style preference.
 *
 * The first cut called this at the bottom of this module behind
 * `if (typeof window !== 'undefined')`, on the reasoning that the guard would also
 * keep it a no-op inside the land-bake Web Worker's module graph, which imports this
 * file and has no `window`. The reasoning was sound and the guard did not survive the
 * build: the bundler targets the browser, so it folds `typeof window !== 'undefined'`
 * to a constant true and DELETES the branch — in both places, here and at the call
 * site. The shipped worker chunk read
 * `"1"===new URLSearchParams(window.location.search).get("tune")&&…`, threw
 * `ReferenceError: window is not defined` on every page load, and
 * `land-bake-client.ts`'s `worker.onerror` quietly terminated the worker and fell
 * back to baking on the main thread. Nothing looked wrong — the scene is identical
 * either way — so unit tests (jsdom has a `window`), the e2e suite and every capture
 * were green while Task 47's whole worker offload was dead.
 *
 * A guard a minifier can constant-fold is not a guard. So the environment test is
 * gone and the CALLER is the guarantee instead: `small-world-experience.tsx` invokes
 * this at module scope, and that module is a client component the worker's graph
 * cannot reach. This file goes back to being what its header promises — a leaf with
 * no side effects at import — which is also why the worker's copy of `DIALS` sits at
 * defaults exactly as `readLandDials`'s header documents.
 *
 * WHY THE CALL SITE IS EARLY ENOUGH: it runs at the experience module's own import
 * time, before that module's component is ever rendered and therefore before the
 * scene mounts or reads a `.value` off `DIALS`.
 */
export function initPersistence(search: string): void {
  persistenceEnabled = isTuneEnabled(search)
  if (!persistenceEnabled) return
  restoreFromStorage()
}
