# Powder Lines Redesign (Alto-Grade 2D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Powder Lines' feel and render layers so the run is genuinely fun (momentum-as-currency, forgiveness, juice) and Alto's-Adventure-grade beautiful (day-cycle gradient light, parallax silhouettes, procedurally animated rider with scarf), keeping the tested sim skeleton.

**Architecture:** Six milestones, each a playable checkpoint gated by an orchestrator Chrome playtest. Sim modules stay pure and unit-tested (slope, rider physics contract, tricks, camera math); the render layer is rebuilt as small modules under `components/labs/snowpark/render/`. Feel first on placeholder visuals (M1), then juice (M2), world (M3), rider rig (M4), integration (M5), polish (M6).

**Tech Stack:** Canvas 2D on the existing engine; Next.js 15 / React 19; Vitest unit tests; Playwright e2e. Zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-09-labs-snowpark-redesign-design.md` — governs on conflict. Research: `docs/superpowers/research/`.

## Suggested model routing (orchestrator)

| Tasks | Owner |
|---|---|
| 1 (slope), 2 (rider physics), 3 (camera), 7 (sky), 8 (terrain), 9 (rig+scarf) | opus |
| 5 (particles/trail), 6 (fx), 10 (tricks rescore + HUD), 11 (page/skip/e2e), 12 (escalation), 13 (poster) | sonnet |
| 4, and every GATE task | **orchestrator (Fable) only — never dispatched** |

## Global Constraints

- Palette anchors survive: ink `#122630` (rider, type), amber `#d9a441` (sun, score, collect, scarf — the only reward color). Day-cycle phases own authored gradient sets (Task 7 pins starting hexes; tunable ONLY at gates).
- De-slop corrected: art-directed gradient light, tasteful particles, and fluid procedural animation are REQUIRED. Banned: particle confetti, emoji, hype copy ("EPIC!"), undirected glow, lens flares, lazy pastel soup. Copy stays factual, dry, lowercase where shown.
- Exact copy kept from v1: `washed out — press R to retry the section` (imported `BAIL_LINE`), trick card `360 Nose Grab — TypeScript · 6 yrs · expert`, `run it back`, `← gallery`, `expedition log`, `start the run anyway`, `paused`, `resume`, `restart run`, `Esc again → gallery`. New copy: skip affordance reads `skip to the skills`.
- Esc hardening untouched: `input.ts` keydown stays capture-phase; GalleryChrome guard stays; e2e Esc test must keep passing.
- Content only from `data/skills.ts`; no invented skills; no inflated titles.
- Zero new dependencies. No `console.log`. Sim state stays immutable (pure step functions). EXCEPTION (documented in code): render-layer internals (particle pools, trail ring buffers, offscreen caches) may mutate their own private state for performance — they never touch sim state.
- All tuning constants live in exported constant blocks at the top of their module; gates tune constants, tasks do not invent new magic numbers inline.
- `data-testid="hud-score"` survives; e2e suite must stay green throughout.
- Deterministic rendering: no `Math.random` per frame — hash from indices/state (v1 convention).
- Commit prefixes: `feat(snowpark):` / `fix(snowpark):` / `test(snowpark):` / `chore(snowpark):`.

## File structure

```
components/labs/snowpark/
  palette.ts        — kept (anchors); Task 7 adds phase gradient sets alongside
  course.ts         — kept; Task 1 retunes spacing constants only
  slope.ts          — Task 1: re-authored rhythm curve (same 4 export signatures)
  tricks.ts         — Task 10: chain multiplier + lateness bonus (pure)
  rider.ts          — Task 2: physics rework (tuck/detach/forgiveness/landing-quality)
  input.ts          — Task 2: sample() gains spinDir; capture-phase Esc untouched
  use-game-loop.ts  — Task 6: gains hit-stop (freezeFrames) support
  camera.ts         — Task 3: NEW pure camera math (zoom/lead/apex/shake)
  render/           — NEW
    renderer.ts     — Task 4 places orchestrator (placeholder); Task 8 completes layers
    sky.ts          — Task 7: day-cycle gradients, sun arc, snowfall
    terrain.ts      — Task 8: filled silhouettes, rim light, parallax bands, props, carve line
    rider-rig.ts    — Task 9: jointed figure poses + draw
    scarf.ts        — Task 9: verlet chain
    particles.ts    — Task 5: pooled spray/bursts + trail ribbon
    fx.ts           — Task 6: squash spring, speed lines, flashes, shake application
  snowpark-game.tsx — Tasks 4/6/10/11: wiring, HUD restyle, skip path
app/labs/snowpark/page.tsx — Task 11: crawlable skills section
components/labs/snowpark/renderer.ts — DELETED in Task 8 (v1 renderer retired)
scripts/posters/snowpark-poster.html + capture — Task 13: redrawn
```

World coordinates unchanged: x forward, y DOWN; descending slope has positive gradient. All v1 module signatures that survive are binding (`slopeY/slopeGradient/slopeAngle/advanceAlongSlope`, `compileCourse`, `createRider/stepRider/obstacleSurfaceY`, `createInput` controller, `useGameLoop`). The renderer signature CHANGES: `createRenderer(canvas) → { draw(state, course, cam), resize() }` (Task 4).

## Gate protocol (applies to every GATE task)

GATE tasks are orchestrator-only playtests in Chrome against the gate's checklist. Outcome per item: pass, or a constants-tuning commit (`chore(snowpark): tune <what> at gate <letter>`), or a fix dispatch back to the owning task's implementer. A milestone is DONE only when its gate checklist fully passes. Record the gate verdict in the SDD ledger.

---

# Milestone 1 — Feel core (fun with rectangles)

### Task 1: Rhythm slope + course spacing retune

**Files:**
- Modify: `components/labs/snowpark/slope.ts` (whole curve body; keep the 4 export signatures)
- Modify: `components/labs/snowpark/course.ts` (constants only)
- Test: `__tests__/labs/snowpark/slope.test.ts` (update), `__tests__/labs/snowpark/course.test.ts` (should pass unchanged)

**Interfaces:**
- Consumes: nothing.
- Produces (binding, unchanged names): `slopeY(x)`, `slopeGradient(x)`, `slopeAngle(x)`, `advanceAlongSlope(x, ds)`. New exports: `RHYTHM` constants block.

- [ ] **Step 1: Replace the curve with an authored rhythm**

The v1 curve (wavelengths 210/97) is choppy — hills arrive every ~1s at speed, no time to build. New curve: long primary rollers a rider can pump, gentle secondary texture, and a slightly stronger base grade:

```ts
export const RHYTHM = {
  BASE_GRADE: 0.38,
  /** primary rollers — the pumpable build/launch/land tempo */
  PRIMARY: { amp: 110, wavelength: 520 },
  /** secondary texture — keeps lines from feeling synthetic */
  SECONDARY: { amp: 22, wavelength: 173, phase: 2.1 },
} as const
```

`slopeY(x) = BASE_GRADE*x + PRIMARY.amp*sin(x/PRIMARY.wavelength) + SECONDARY.amp*sin(x/SECONDARY.wavelength + SECONDARY.phase)`; `slopeGradient` is its exact analytic derivative (same term-by-term construction as v1); `slopeAngle = atan(gradient)`; `advanceAlongSlope` unchanged.

Max gradient check (do this arithmetic in a code comment): `0.38 + 110/520 + 22/173 ≈ 0.72` downhill max, `0.38 − 0.34 ≈ 0.04` flattest — always descending, never vertical. That "never goes uphill" property is NEW (v1 could tip uphill); it guarantees flow.

- [ ] **Step 2: Update slope tests**

Keep all five v1 invariant tests (determinism, overall descent, gradient-vs-numeric-derivative, angle bounds, forward advance). Change the "descends overall" test to the stronger new invariant and add a rhythm bound:

```ts
it('never tips uphill (gradient stays positive)', () => {
  for (let x = 0; x <= 40_000; x += 37) {
    expect(slopeGradient(x)).toBeGreaterThan(0)
  }
})

it('keeps the slope rideable (max gradient below 0.75)', () => {
  for (let x = 0; x <= 40_000; x += 37) {
    expect(slopeGradient(x)).toBeLessThan(0.75)
  }
})
```

- [ ] **Step 3: Retune course spacing to the rhythm**

In `course.ts` change only: `START_X = 900`, `OBSTACLE_SPACING = 1150`, `STRETCH_GAP = 500`. Rationale comment: one obstacle roughly every other primary roller at cruise. Course tests pass unchanged (they assert relations, not absolute values — verify).

- [ ] **Step 4: Run tests**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/slope.test.ts __tests__/labs/snowpark/course.test.ts --run`
Expected: PASS. NOTE: `__tests__/labs/snowpark/rider.test.ts` may fail until Task 2 lands (physics contract changes) — run it, report status, do NOT fix it in this task.

- [ ] **Step 5: Commit**

```bash
git add components/labs/snowpark/slope.ts components/labs/snowpark/course.ts __tests__/labs/snowpark/slope.test.ts
git commit -m "feat(snowpark): rhythm-authored slope - long pumpable rollers, never uphill"
```

---

### Task 2: Rider physics rework — momentum, forgiveness, landing quality

**Files:**
- Modify: `components/labs/snowpark/rider.ts` (physics body; state machine skeleton, bail/respawn/finish/bookkeeping survive)
- Modify: `components/labs/snowpark/input.ts` (sample shape: add `spinDir`; Escape/capture handling untouched)
- Test: `__tests__/labs/snowpark/rider.test.ts` (rewrite to new contract), `__tests__/labs/snowpark/input.test.ts` (keep passing)

**Interfaces:**
- Consumes: Task 1 slope exports; `compileCourse`; tricks v1 (`trickName/trickScore/collectLine` — Task 10 rescoring comes later; use v1 scoring until then).
- Produces (Tasks 3–6, 9, 11 rely on these): `RiderState` gains `tucking: boolean`, `chain: number`, `airtime: number`, `rotationIdleS: number`, `impact: number` (0..1 landing impulse for squash/shake, decays in state), `justLanded: 'clean' | 'scrubbed' | null`, `justLaunched: boolean`, `bigMoment: boolean` (fires one frame on big-trick landing/bail — hit-stop hook). `RiderInput` becomes `{ jumpHeld, jumpPressed, grabHeld, spinDir: -1 | 0 | 1, retryPressed }` (spin presses replaced by held direction). Constants block below is the single tuning surface.

- [ ] **Step 1: Write the constants block (binding starting values; gates tune)**

```ts
export const PHYS = {
  GRAVITY: 1800,
  /** on-snow accel = GRAVITY * sin(angle) * (tucking ? TUCK_ACCEL : 1) - DRAG */
  TUCK_ACCEL: 1.55,
  DRAG: 90,
  MIN_SPEED: 130,
  MAX_SPEED: 560,
  START_SPEED: 220,
  BASE_POP: 340,
  CHARGE_POP: 330,
  MAX_CHARGE_S: 0.5,
  /** ballistic-vs-terrain detach epsilon (world units) */
  DETACH_EPS: 2,
  COYOTE_S: 0.1,
  BUFFER_S: 0.1,
  /** deg/s while a rotation input is held (backflip via Space, spins via arrows) */
  SPIN_RATE: 420,
  SNAP_DEG: 20,
  LANDING_TOLERANCE_DEG: 35,
  CLEAN_BOOST: 60,
  SCRUB_FACTOR: 0.75,
  /** final rotation must have stopped within this window before touchdown for the late bonus */
  LATE_WINDOW_S: 0.3,
  GRIND_SNAP_DIST: 18,
  SURFACE_RAISE: 42,
  BAIL_TIME: 1.2,
  RESPAWN_LEAD: 600,
  GRIND_EXIT_POP: 200,
} as const
```

Keep `BAIL_LINE` verbatim. Delete the old scattered constants; every consumer imports from `PHYS`.

- [ ] **Step 2: Implement the new physics contract**

Binding behavior (decompose into helpers < 50 lines; every path returns new state):

**Snow:**
- `speed += (GRAVITY * sin(slopeAngle(x)) * (tucking ? TUCK_ACCEL : 1) - DRAG) * dt`, clamped `[MIN_SPEED, MAX_SPEED]`. `tucking = input.jumpHeld`; while tucking, `charge = min(charge + dt / MAX_CHARGE_S, 1)`.
- Advance along slope (v1). Release of jumpHeld with charge > 0 → pop `BASE_POP + charge * CHARGE_POP` (v1 launch math, `launchAngleDeg` from slope, kicker boost KEPT: pop × 1.45 inside a kicker footprint with attribution).
- **Natural detach:** after advancing, compute ballistic candidate `by = y + vyEquiv * dt` where `vyEquiv = sin(angle) * speed` and compare to `slopeY(bx)`: if `slopeY(bx) - by > DETACH_EPS` (terrain fell away faster than gravity would carry), enter air with `vx = cos(angle)*speed`, `vy = sin(angle)*speed`, `justLaunched = true`, coyote window opens (`coyoteT = COYOTE_S`).
- **Coyote:** while airborne with `coyoteT > 0` (decaying), a jump release (or press+release) still applies the pop to `vy`. After it expires, jump input in air only buffers.
- Passed-obstacle bookkeeping, finish, respawn, R — all v1, unchanged.

**Air:**
- Ballistic integration (v1). `airtime += dt`.
- Rotation: `rotationDir = spinDir !== 0 ? spinDir : (jumpHeld ? 1 : 0)`; while nonzero, `rotationDeg += SPIN_RATE * dt` (magnitude; direction is render concern) and `rotationIdleS = 0`; else `rotationIdleS += dt`. No queued targets anymore — continuous hold.
- `grabbing = grabHeld`; grab latches `grabHappened`.
- **Buffer:** `jumpPressed` in air with no coyote → `bufferT = BUFFER_S` (decays); consumed on landing (see grind exit too).
- Grind snap: v1 rule, `attributedObstacle` set, chain continues through grinds.

**Landing** (`y >= slopeY(x)`):
- `boardDiff = wrap180(launchAngleDeg + rotationDeg - slopeAngleDeg(x))` folded to `[-90, 90]` (v1 mod-180 formula).
- `|boardDiff| <= SNAP_DEG` → **clean**: snap rotation to the nearest multiple of 180, `speed = clamp(project(vx, vy, slopeAngle) + CLEAN_BOOST, ...)`, `chain += 1`, `impact = clamp(|vy| / 900, 0.2, 1)`, `justLanded = 'clean'`; if trick had `rotationDeg >= 180` and `rotationIdleS <= LATE_WINDOW_S` mark the banked trick late (pass `late: true` into scoring — v1 trickScore until Task 11, so store it on the CollectEvent as `late` for now). Big trick (`rotationDeg >= 360` or grind ≥ 100) → `bigMoment = true`.
- `SNAP_DEG < |boardDiff| <= LANDING_TOLERANCE_DEG` → **scrubbed**: land, `speed = project(...) * SCRUB_FACTOR` (clamped), chain PRESERVED but no boost, no trick bank, `justLanded = 'scrubbed'`.
- beyond → **bail** (v1 tumble/respawn; `chain = 0`, `bigMoment = true`).
- Buffered jump fires on clean/scrubbed landing (pop with zero charge).
- Scoring on clean landing with attribution: v1 `trickScore(...) `× v1 combo semantics replaced by `chain` (pass `chain` where combo went) — Task 10 finalizes the multiplier math; until then `combo = chain` keeps v1 tests' shape.

**Flags lifecycle:** `justLanded/justLaunched/bigMoment` are one-step flags — set in the step that produced them, cleared at the start of the next step (consumers read them the frame they appear).

- [ ] **Step 3: Update input.ts sample shape**

`RiderInput.spinLeftPressed/spinRightPressed` replaced by `spinDir: -1 | 0 | 1` derived from ArrowLeft/ArrowRight HELD state (both → 0). Touch: horizontal swipe sets a held direction for 0.4 s. Everything about Escape/capture/keyup/cleanup untouched. Update `__tests__/labs/snowpark/input.test.ts` only if the shape change breaks compilation (Escape tests must not change).

- [ ] **Step 4: Rewrite rider tests to the new contract**

Test cases (write real code for each; use the run/idle helpers from v1's file):

| Case | Assertion |
|---|---|
| createRider | mode snow, x 0, glued, chain 0, collected sized |
| immutability | frozen state steps without throw |
| gravity accel | 2 s idle downhill: speed strictly increased, within clamps |
| tuck beats idle | 1.5 s with jumpHeld vs without: tucked speed strictly greater; charge ≈ 1 |
| natural detach | place rider before a primary crest at MAX_SPEED (construct state), run: mode becomes 'air' without any jump input |
| coyote pop | detach naturally, release jump 0.05 s later: vy jumps negative by ≥ BASE_POP·0.9 |
| buffer | press jump 0.05 s before landing: next snow frame → air again |
| continuous rotation | hold jump in air 0.5 s: rotationDeg ≈ 210 (± SPIN_RATE·dt) |
| snap-clean | land with boardDiff 15°: justLanded 'clean', rotation snapped to 180-multiple, speed gained ≥ CLEAN_BOOST·0.5 |
| scrubbed | land with boardDiff 28°: justLanded 'scrubbed', chain preserved, speed reduced |
| bail | land with boardDiff 50°: mode bail, chain 0 |
| late bonus flag | rotation ends 0.1 s before a clean landing with ≥180°: banked event has late true |
| grind chain | v1 grind test adapted: chain increments after grind + clean landing |
| respawn/R/finish | v1 tests adapted to PHYS constants |

Constructing precise boardDiff scenarios: build air states directly (v1 pattern) with `launchAngleDeg = slopeAngleDeg(landingXEstimate) + diff` and `rotationDeg = 0` — document the helper in the test file.

- [ ] **Step 5: Run tests until green, then whole unit suite**

Run: `pnpm vitest --project unit __tests__/labs/snowpark/rider.test.ts --run` then `pnpm test:unit --run`
Expected: rider suite green; `snowpark-game.tsx` may fail to COMPILE against the new RiderInput — if so, make the minimal mechanical fix in the shell (map old fields → new) without changing behavior, and report it.

- [ ] **Step 6: Commit**

```bash
git add components/labs/snowpark/rider.ts components/labs/snowpark/input.ts __tests__/labs/snowpark/rider.test.ts __tests__/labs/snowpark/input.test.ts components/labs/snowpark/snowpark-game.tsx
git commit -m "feat(snowpark): momentum physics - tuck, natural crest detach, forgiveness, landing quality"
```

---

### Task 3: Camera as a speed instrument

**Files:**
- Create: `components/labs/snowpark/camera.ts`
- Test: `__tests__/labs/snowpark/camera.test.ts`

**Interfaces:**
- Consumes: `RiderState` (reads x, y, vx, vy, speed, mode).
- Produces: `CameraState = { x: number; y: number; zoom: number; shakeMag: number; shakeT: number }`; `createCamera(rider: RiderState): CameraState`; `updateCamera(cam: CameraState, rider: RiderState, dt: number): CameraState` (pure); `addShake(cam: CameraState, mag: number): CameraState`; `shakeOffset(cam: CameraState): { x: number; y: number }` (deterministic from shakeT); `CAM` constants.

- [ ] **Step 1: Constants + contract**

```ts
export const CAM = {
  /** rider screen anchor as viewport fractions */
  ANCHOR_X: 0.35,
  ANCHOR_Y: 0.45,
  /** zoom 1 at MIN_SPEED shrinking to ZOOM_FAR at MAX_SPEED (wider view) */
  ZOOM_FAR: 0.74,
  /** camera leads travel by LEAD_S seconds of current velocity, clamped */
  LEAD_S: 0.35,
  LEAD_MAX: 260,
  /** follow stiffness (1/s); APEX_STIFF applies when airborne and |vy| < APEX_VY */
  STIFF: 6,
  APEX_STIFF: 2.2,
  APEX_VY: 80,
  SHAKE_DECAY: 8,
  SHAKE_FREQ: 37,
} as const
```

Behavior: target `tx = rider.x + clamp(rider.vx-equivalent * LEAD_S, -LEAD_MAX, LEAD_MAX)` (on snow use `cos(angle)*speed` as vx), `ty = rider.y`; camera eases with `k = 1 - exp(-stiff * dt)` where stiff is `APEX_STIFF` at air apex else `STIFF`; zoom target lerps 1 → ZOOM_FAR by `speed01 = (speed - MIN) / (MAX - MIN)` (airborne: use `hypot(vx, vy)`), eased with STIFF. `addShake` sets `shakeMag = max(existing, mag)`, `shakeT = 0`; update advances shakeT and decays mag by `exp(-SHAKE_DECAY*dt)`; `shakeOffset = mag * { sin(shakeT*SHAKE_FREQ), cos(shakeT*SHAKE_FREQ*1.3) }`.

- [ ] **Step 2: Tests (write these exactly)**

```ts
import { describe, expect, it } from 'vitest'
import { CAM, addShake, createCamera, shakeOffset, updateCamera } from '@/components/labs/snowpark/camera'
import { compileCourse } from '@/components/labs/snowpark/course'
import { PHYS, createRider } from '@/components/labs/snowpark/rider'

const course = compileCourse()
const rider = createRider(course)

describe('camera', () => {
  it('converges toward the rider and never overshoots in one step', () => {
    let cam = { ...createCamera(rider), x: rider.x - 500 }
    const next = updateCamera(cam, rider, 1 / 60)
    expect(next.x).toBeGreaterThan(cam.x)
    expect(next.x).toBeLessThanOrEqual(rider.x + CAM.LEAD_MAX)
  })

  it('zooms out as speed rises, bounded by ZOOM_FAR', () => {
    const slow = { ...rider, speed: PHYS.MIN_SPEED }
    const fast = { ...rider, speed: PHYS.MAX_SPEED }
    let camSlow = createCamera(slow)
    let camFast = createCamera(fast)
    for (let i = 0; i < 240; i++) {
      camSlow = updateCamera(camSlow, slow, 1 / 120)
      camFast = updateCamera(camFast, fast, 1 / 120)
    }
    expect(camFast.zoom).toBeLessThan(camSlow.zoom)
    expect(camFast.zoom).toBeGreaterThanOrEqual(CAM.ZOOM_FAR - 0.01)
  })

  it('shake decays and its offset is deterministic', () => {
    let cam = addShake(createCamera(rider), 10)
    const o1 = shakeOffset(cam)
    const o1again = shakeOffset(cam)
    expect(o1).toEqual(o1again)
    for (let i = 0; i < 120; i++) cam = updateCamera(cam, rider, 1 / 120)
    expect(cam.shakeMag).toBeLessThan(0.5)
  })

  it('is pure - does not mutate its inputs', () => {
    const cam = Object.freeze(createCamera(rider))
    expect(() => updateCamera(cam, rider, 1 / 60)).not.toThrow()
  })
})
```

- [ ] **Step 3: TDD cycle**

Run test (fails: module missing) → implement → `pnpm vitest --project unit __tests__/labs/snowpark/camera.test.ts --run` → PASS.

- [ ] **Step 4: Commit**

```bash
git add components/labs/snowpark/camera.ts __tests__/labs/snowpark/camera.test.ts
git commit -m "feat(snowpark): camera math - speed zoom, velocity lead, apex hang, shake"
```

---

### Task 4 (ORCHESTRATOR): M1 wiring on placeholder visuals

Orchestrator-implemented (small, cross-cutting, and the gate follows immediately): create `components/labs/snowpark/render/renderer.ts` exporting `createRenderer(canvas) → { draw(state, course, cam), resize() }` — placeholder pass: flat ice sky, single 3px terrain line, obstacles as v1, rider as a 24×8 ink rectangle rotated to board angle, camera applied (translate/zoom/shake). Rewire `snowpark-game.tsx`: hold `CameraState` in a ref updated in `step` via `updateCamera` (+ `addShake(impact*12)` on landings/bails), pass to draw; switch import to `render/renderer`. Keep old `renderer.ts` file untracked-deleted only in Task 8. `pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit --run` green, commit `feat(snowpark): M1 wiring - camera-driven placeholder renderer`.

### GATE A (ORCHESTRATOR): the movement is fun with rectangles

Playtest checklist — all must pass before M2:
- [ ] Holding Space downhill visibly builds speed; releasing at a trough pops a satisfying launch; crests at speed launch by themselves.
- [ ] Speed reads through the camera alone (zoom-out + lead) even with placeholder art.
- [ ] A missed jump input near a crest still fires (coyote); a pre-landing press fires on touchdown (buffer).
- [ ] Backflip hold-to-rotate feels controllable; snap-assist makes near-landings land; over-rotation bails feel fair.
- [ ] 60 s of riding produces no dead flats, no uphill stalls, no unfair bails.
- [ ] Tuning pass done via `PHYS`/`CAM`/`RHYTHM` constants only; each tune committed.
- [ ] Verdict + surviving concerns recorded in the SDD ledger.

---

# Milestone 2 — Juice (dead → alive)

### Task 5: Particles and trail ribbon

**Files:**
- Create: `components/labs/snowpark/render/particles.ts`
- Modify: `components/labs/snowpark/render/renderer.ts` (call sites)

**Interfaces:**
- Consumes: `RiderState` flags from Task 2 (`justLanded`, `justLaunched`, `impact`, `mode`, `tucking`, `chain`), phase colors NOT yet (M3) — until Task 7, colors are `palette.bluePale`/`palette.ink`.
- Produces: `createParticles(): ParticleSystem` where `ParticleSystem = { spray(x, y, speed01, dt): void; burst(x, y, impact): void; pushTrail(x, y, chainTier): void; update(dt): void; draw(ctx, chainTier): void; clear(): void }`. Render-layer internal mutation allowed (documented pool).

- [ ] **Step 1: Implement pooled particles**

Fixed pool of 256 `{ x, y, vx, vy, life, size }` (pre-allocated, free-list index; zero per-frame allocation). `spray`: while carving (mode snow, speed01 > 0.25), emit `ceil(speed01 * 3)` particles per step at the board's rear contact point, velocity opposing travel ± hash jitter, life 0.35–0.6 s, drawn as 1.5–2.5px circles. `burst`: on landing, `8 + round(impact * 22)` particles fanning upward-back, life to 0.9 s. Gravity 600 on particles; alpha = life01. Deterministic jitter via the v1 hash convention (seed from pool index + spawn count) — no `Math.random`.

Trail ribbon: internal ring buffer of 48 board positions (pushed every step from `pushTrail`), drawn as one polyline whose width tapers 4→0 and whose alpha tapers 0.5→0; `chainTier = min(floor(chain / 3), 3)` raises width (+1 per tier) and, from M3 on, brightness. `clear()` empties pool + ring (respawn hook — renderer detects x jumping backward, v1 convention).

- [ ] **Step 2: Wire into renderer draw order**

Order within placeholder renderer: terrain line → trail → obstacles → particles → rider rect. Spray/burst/pushTrail called from `draw` by reading state flags (renderer stays the only caller; sim untouched). Bail: one burst with `impact = 1` on the frame `mode` enters 'bail'.

- [ ] **Step 3: Verify**

`pnpm exec tsc --noEmit && pnpm lint` clean; `grep -n "Math.random" components/labs/snowpark/render/particles.ts` → no matches. Manual dev-server look allowed but GATE B is the judge.

- [ ] **Step 4: Commit**

```bash
git add components/labs/snowpark/render/particles.ts components/labs/snowpark/render/renderer.ts
git commit -m "feat(snowpark): pooled carve spray, landing bursts, tapering trail ribbon"
```

---

### Task 6: FX — squash/stretch, speed lines, hit-stop, flashes

**Files:**
- Create: `components/labs/snowpark/render/fx.ts`
- Modify: `components/labs/snowpark/use-game-loop.ts` (hit-stop), `components/labs/snowpark/render/renderer.ts` (apply squash + speed lines), `components/labs/snowpark/snowpark-game.tsx` (combo pop CSS + bigMoment wiring)

**Interfaces:**
- Consumes: `impact`, `justLanded`, `justLaunched`, `bigMoment`, `speed01` (derive: `(speed - PHYS.MIN_SPEED) / (PHYS.MAX_SPEED - PHYS.MIN_SPEED)`), camera `shakeOffset` (already applied in Task 4).
- Produces: `createFx(): Fx` where `Fx = { onLand(impact): void; onLaunch(): void; update(dt): void; riderScale(): { sx: number; sy: number }; drawSpeedLines(ctx, w, h, speed01): void }`. `useGameLoop` opts gain `freeze(frames: number): void` exposed via a returned handle: `useGameLoop(opts): { freeze(frames: number): void }`.

- [ ] **Step 1: Squash spring**

Damped spring on rider scale: `onLand(impact)` sets velocity toward squash (`sy 1 - 0.35*impact`, `sx 1 + 0.35*impact` — opposed, area-conserving), `onLaunch()` a smaller stretch (`sy 1.12, sx 0.92`); spring constants `STIFF 90`, `DAMP 12`, returning to (1,1). `riderScale()` read by the renderer when drawing the rider (placeholder rect now, rig in M4 — same hook).

- [ ] **Step 2: Speed lines**

`drawSpeedLines`: when `speed01 > 0.72`, draw 12 horizontal streaks near the viewport edges (top/bottom thirds), length `40 + 120*(speed01-0.72)/0.28`, alpha up to 0.18, ink color, positions from hash(i, floor(time*8)) so they shimmer without randomness. Nothing below the threshold.

- [ ] **Step 3: Hit-stop in the loop**

`use-game-loop.ts`: internal `freezeFrames` counter; while > 0, decrement per rAF, run `render()` but skip `step()` accumulation (and don't accumulate the frozen time — reset accumulator on unfreeze, same as unpause). Return `{ freeze }` from the hook. Shell: on `bigMoment` call `freeze(4)`.

- [ ] **Step 4: Combo counter pop**

Shell HUD: when `hud.score` increases, re-trigger a 180 ms CSS animation on the score/combo block (scale 1 → 1.18 → 1, brief `palette.amber` → white → amber flash). Implement by keying the element on a bump counter. No emoji, no text change.

- [ ] **Step 5: Verify + commit**

`pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit --run` green (game-loop change must not break existing behavior — pause/visibility tests unaffected; e2e still passes later at gates).

```bash
git add components/labs/snowpark/render/fx.ts components/labs/snowpark/use-game-loop.ts components/labs/snowpark/render/renderer.ts components/labs/snowpark/snowpark-game.tsx
git commit -m "feat(snowpark): squash-stretch, speed lines, hit-stop, combo pop"
```

### GATE B (ORCHESTRATOR): actions feel alive

- [ ] Carving visibly sprays; landings burst proportional to impact; the trail draws your momentum arc.
- [ ] Landing squash + tiny shake makes weight legible; launches stretch.
- [ ] Big-trick landings hit-stop for a beat and feel like a peak, not a glitch.
- [ ] Speed lines appear only at real speed and read as "fast", not noise.
- [ ] Nothing fires at rest; effects never obscure the rider.
- [ ] Tunes via constants only; ledger verdict recorded.

---

# Milestone 3 — The world (light, depth, atmosphere)

### Task 7: Sky — day cycle, sun, snowfall

**Files:**
- Create: `components/labs/snowpark/render/sky.ts`
- Modify: `components/labs/snowpark/palette.ts` (add `phases` export alongside anchors)
- Test: `__tests__/labs/snowpark/sky.test.ts` (phase math only)

**Interfaces:**
- Consumes: run progress `p = clamp(rider.x / course.finishX, 0, 1)`.
- Produces: `skyColors(p): PhaseColors` where `PhaseColors = { top: string; horizon: string; sun: string; haze: string; snow: string; band: string; glow01: number }` (all `#rrggbb`; `glow01` ramps 0→1 across the night phase for Task 12's marker glow); `drawSky(ctx, w, h, p, t): void` (gradient + sun disc + snowfall); `PHASES` constants.

- [ ] **Step 1: Pin the phase palette (starting values; GATE C tunes)**

```ts
export const PHASES = [
  { at: 0.0,  top: '#cfe0ec', horizon: '#f2dfc4', sun: '#e6b95c', haze: '#dfe9f0', snow: '#f3f7fa', band: '#9db6c8' },
  { at: 0.3,  top: '#d8e9f2', horizon: '#eef3f6', sun: '#e9c97e', haze: '#e4edf2', snow: '#eef3f6', band: '#8fa9bd' },
  { at: 0.58, top: '#a9bcd8', horizon: '#eab387', sun: '#d9843f', haze: '#c9c3cf', snow: '#e8e3e6', band: '#6d7f9e' },
  { at: 0.82, top: '#0e1f30', horizon: '#2c4a62', sun: '#d8e4ee', haze: '#16293a', snow: '#adc3d4', band: '#22384c' },
] as const
```

`skyColors(p)`: piecewise-linear RGB lerp between neighboring phases (hex→rgb→lerp→hex helper in this file); `glow01 = smoothstep(0.78, 0.92, p)`. Pure and unit-testable.

- [ ] **Step 2: Tests**

```ts
it('returns exact phase colors at the pinned stops', () => {
  expect(skyColors(0).top).toBe('#cfe0ec')
  expect(skyColors(0.82).horizon).toBe('#2c4a62')
})
it('interpolates monotonically between stops', () => {
  const a = skyColors(0.1), b = skyColors(0.2)
  expect(a.top).not.toBe(b.top)
})
it('glow ramps only near night', () => {
  expect(skyColors(0.5).glow01).toBe(0)
  expect(skyColors(1).glow01).toBeGreaterThan(0.9)
})
```

- [ ] **Step 3: drawSky**

Vertical `createLinearGradient(0,0,0,h)` top→horizon (two stops; cache the gradient per color pair, rebuild only when colors change — string compare). Sun: disc radius `0.055*h` with a single soft halo (radial gradient sun→transparent at 2.2× radius, alpha ≤ 0.35 — art-directed, this is the allowed glow); position arcs with p: `sx = (0.78 - 0.5*p) * w`, `sy = (0.16 + 0.42*p) * h` (sets toward the horizon; after p 0.82 it reads as a moon via the night sun color). Snowfall: from `p > 0.62`, up to 60 pooled flakes drifting down-left, density ramping with p, drawn 1.5–2.5px in `snow` color at alpha 0.7 — reuse the particles-pool pattern (own small pool, deterministic hash drift).

- [ ] **Step 4: Wire, verify, commit**

Renderer background = `drawSky` (replaces flat fill). `pnpm vitest --project unit __tests__/labs/snowpark/sky.test.ts --run` PASS; tsc/lint clean.

```bash
git add components/labs/snowpark/render/sky.ts components/labs/snowpark/palette.ts __tests__/labs/snowpark/sky.test.ts components/labs/snowpark/render/renderer.ts
git commit -m "feat(snowpark): day-cycle gradient sky, arcing sun, ramping snowfall"
```

---

### Task 8: Terrain — filled silhouettes, rim light, parallax depth, retire v1 renderer

**Files:**
- Create: `components/labs/snowpark/render/terrain.ts`
- Modify: `components/labs/snowpark/render/renderer.ts` (full layer order)
- Delete: `components/labs/snowpark/renderer.ts` (v1)

**Interfaces:**
- Consumes: `slopeY/slopeAngle`, `PhaseColors` from Task 7, camera transform, trail positions (carve line), course obstacles (kept v1 obstacle draw, restyled strokes to phase-aware ink).
- Produces: `drawTerrain(ctx, view, colors): void`, `drawParallax(ctx, view, colors, band): void` where `view = { camX, camY, zoom, w, h, p }`; `BANDS` constants.

- [ ] **Step 1: Main terrain becomes a filled body**

Sample the snowline across the viewport (every 16 screen px), build a closed path down to the bottom edge, fill with a vertical gradient `colors.snow → darken(colors.snow, 12%)`. **Rim light:** stroke the snowline twice — 3px `mix(colors.sun, #ffffff, 0.5)` at alpha 0.9, then 1px `colors.snow` inside — the lit crest edge. **Carve line:** stroke the last ~48 trail positions (from the particle system's ring, exposed via a getter) directly on the surface 1.5px in `darken(colors.snow, 25%)` — the board's mark in the snow. Color helpers (`darken`, `mix`) live in this file.

- [ ] **Step 2: Parallax bands (the 2.5D depth)**

```ts
export const BANDS = [
  { factor: 0.12, height: 0.42, ampScale: 2.6, alpha: 1.0 },
  { factor: 0.28, height: 0.55, ampScale: 1.8, alpha: 1.0 },
  { factor: 0.5,  height: 0.7,  ampScale: 1.2, alpha: 1.0 },
] as const
```

Each band: a ridge line `y = bandBase + ampScale * (55 * sin(x / 340 + band seed) + 24 * sin(x / 130 + seed*2))` filled to bottom in `colors.band` mixed toward `colors.haze` by depth (band 0 = most hazed). Bands translate by `camX * factor`. **Cache:** render each band once to an offscreen canvas 2× viewport width, redraw only when its colors change (string compare) or on resize; per-frame cost is a translated drawImage. Between bands, a haze veil: full-width rect of `colors.haze` at alpha 0.22. **Props:** sparse pines (two stacked triangles, ink mixed to band color) hashed along each band ridge, scale by band depth; and a rare foreground occluder — a large dark pine sweeping past at factor 1.35, at most one on screen, alpha 0.9.

- [ ] **Step 3: Final layer order in renderer.ts**

sky → band[0] → haze → band[1] → haze → band[2] → haze → terrain body + rim + carve → trail ribbon → obstacles (v1 shapes, strokes in `mix(ink, colors.band, 0.15)`, labels ink, collected dot amber) → particles → rider (placeholder rect + fx scale until M4) → speed lines → finish banner. Delete `components/labs/snowpark/renderer.ts`; fix any imports.

- [ ] **Step 4: Verify + commit**

tsc/lint/unit green; `grep -rn "Math.random" components/labs/snowpark/render/` no matches; dev-server screenshot for the gate.

```bash
git add -A components/labs/snowpark/ && git commit -m "feat(snowpark): filled rim-lit terrain, cached parallax bands, haze depth; retire v1 renderer"
```

### GATE C (ORCHESTRATOR): it looks like a place, not a diagram

- [ ] Screenshot at p ≈ 0.05, 0.4, 0.7, 0.95: each reads as a distinct time of day; colors feel authored (compare against Alto reference screenshots side by side).
- [ ] Depth is legible: three bands + haze read as kilometers, not stripes; parallax motion sells travel.
- [ ] Rim light makes the snowline pop; carve line trails the rider.
- [ ] The sun/halo is atmospheric, not a lens flare; night is legible.
- [ ] 60 fps steady on desktop Chrome (DevTools performance check); no per-frame band redraws (verify cache hits via a counter in dev).
- [ ] Palette tunes via PHASES/BANDS constants only; ledger verdict recorded.

---

# Milestone 4 — The rider (a figure, not a glyph)

### Task 9: Jointed rig + verlet scarf + bail tumble

**Files:**
- Create: `components/labs/snowpark/render/rider-rig.ts`
- Create: `components/labs/snowpark/render/scarf.ts`
- Modify: `components/labs/snowpark/render/renderer.ts` (replace placeholder rect)

**Interfaces:**
- Consumes: `RiderState` (mode, x, y, speed, tucking, charge, rotationDeg, launchAngleDeg, grabbing, bailTimer, impact, time), `Fx.riderScale()`, phase colors (ink stays `palette.ink`; scarf `palette.amber`).
- Produces: `drawRider(ctx, state, scale, colors): void` (rig), `createScarf(): Scarf` with `Scarf = { update(anchorX, anchorY, windX, dt): void; draw(ctx): void; reset(x, y): void }`; `RIG` constants.

- [ ] **Step 1: The rig**

Target height ~56 world units (≈ 2.5× v1) so the rider reads. Pose model — a small kinematic chain computed per frame from state, no assets:

```ts
export const RIG = {
  BOARD_LEN: 46,
  LEG: 16,
  TORSO: 20,
  ARM: 14,
  HEAD_R: 5.5,
  /** crouch01 sources: charge while tucking, impact spring while landing */
  CROUCH_MAX: 0.45,
  LEAN_GAIN: 0.5,
} as const
```

Board angle: on snow `slopeAngle`, in air `launchAngleDeg + rotationDeg` (the physics truth — the flip IS the board rotating). Feet at board ± 30% length; knees bend by `crouch01 = max(tucking ? charge : 0, impactSpring)` (read `Fx.riderScale` squash as the impact source); hips above midpoint; torso leans forward by `LEAN_GAIN * slopeAngle + 0.3 * speed01` (in air: tucks toward the board when rotating); head on top; front arm reaches to the board edge when `grabbing`, else arms trail by speed. Draw: round-capped ink strokes (legs 3px, torso 4px, arms 2.5px), board 5px with a 1px `colors.snow` deck line, head filled disc. Apply `fx.riderScale()` around the rig center (squash/stretch). All joints from state → deterministic.

Bail: reuse v1's decomposition approach but with the rig's five pieces (board, two legs-as-one, torso+arms, head) tumbling with per-piece angular velocity seeded deterministically from bail-start time; pieces fade none — they stay ink.

- [ ] **Step 2: The scarf**

Verlet chain: 26 points, segment length 3.2, 3 constraint iterations, gravity 500, wind `-vxEquiv * 0.9 ± small hash flutter`, anchored at the neck joint (rig exposes the neck position via `drawRider` return or a shared `riderJoints(state)` helper — pick the helper: `riderJoints(state): { neck: {x,y}, boardCenter: {x,y} }` exported for scarf + future needs). Draw as a tapering polyline 4→1.5px in `palette.amber`, alpha 0.95. `reset` on respawn (x jumps backward). During bail: anchor follows the torso piece.

- [ ] **Step 3: Wire + verify + commit**

Replace the placeholder rect in renderer; scarf updates in `draw` (render-side state, allowed). tsc/lint/unit green; `grep -rn "Math.random"` render/ → none.

```bash
git add components/labs/snowpark/render/rider-rig.ts components/labs/snowpark/render/scarf.ts components/labs/snowpark/render/renderer.ts
git commit -m "feat(snowpark): procedural jointed rider with verlet scarf and rig-piece bail"
```

### GATE D (ORCHESTRATOR): the rider is alive

- [ ] The figure visibly crouches on tuck, extends on pop, tucks through flips, reaches on grab; the scarf flows and whips on launches.
- [ ] Rotation reads mid-air at a glance (you can count a 360).
- [ ] Landings squash the figure believably; bails tumble as pieces, not a glitch.
- [ ] The rider reads at all four times of day; silhouette never muddies into terrain.
- [ ] Tunes via RIG constants only; ledger verdict.

---

# Milestone 5 — Integration (scores, skills, skip, crawlable)

### Task 10: Trick rescore — chain multiplier + lateness

**Files:**
- Modify: `components/labs/snowpark/tricks.ts`
- Modify: `components/labs/snowpark/rider.ts` (bank call site passes `chain`/`late`)
- Modify: `components/labs/snowpark/snowpark-game.tsx` (HUD: multiplier loud)
- Test: `__tests__/labs/snowpark/tricks.test.ts` (extend)

**Interfaces:**
- Consumes: `chain`, `late` from Task 2's landing contract.
- Produces: `trickScore(t: TrickInput, years: number, chain: number): number` where the combo term becomes `1 + CHAIN_STEP * chain` (`CHAIN_STEP = 0.25` replaces `COMBO_STEP = 0.1`); `TrickInput` gains `late: boolean` worth `LATE_BONUS = 1.5` multiplier. `trickName` unchanged except: `late` tricks prefix nothing (name stays dry — lateness shows in points). `collectLine` unchanged.

- [ ] **Step 1: Extend tests (exact cases)**

```ts
it('multiplies by the chain', () => {
  const t = { rotationDeg: 180, grab: false, grindLength: 0, late: false }
  expect(trickScore(t, 4, 4)).toBe(Math.round(250 * 4 * 2)) // 1 + 0.25*4 = 2
})
it('pays the late bonus', () => {
  const t = { rotationDeg: 360, grab: false, grindLength: 0, late: true }
  const base = { ...t, late: false }
  expect(trickScore(t, 4, 0)).toBe(Math.round(trickScore(base, 4, 0) * 1.5))
})
```

Update existing trickScore tests to the new signature (`combo` param → `chain`, `COMBO_STEP` → `CHAIN_STEP`). Keep the exact collect-line test untouched.

- [ ] **Step 2: TDD cycle, then rider call-site + HUD**

Implement; rider banks with `trickScore({ ...trick, late }, skill.years, chainBeforeThisLanding)`. HUD: the multiplier becomes the loud element — `×{1 + 0.25*chain}` shown as `×2.5` in amber beside the score whenever `chain >= 1`, scale-pops on change (reuse Task 6's bump pattern); score smaller above it. Run rider + tricks suites + full unit.

- [ ] **Step 3: Commit**

```bash
git add components/labs/snowpark/tricks.ts components/labs/snowpark/rider.ts components/labs/snowpark/snowpark-game.tsx __tests__/labs/snowpark/tricks.test.ts __tests__/labs/snowpark/rider.test.ts
git commit -m "feat(snowpark): chain multiplier scoring with land-it-late bonus, loud HUD multiplier"
```

---

### Task 11: Skip path, crawlable skills, recap restyle, e2e

**Files:**
- Modify: `app/labs/snowpark/page.tsx` (crawlable section)
- Modify: `components/labs/snowpark/snowpark-game.tsx` (skip affordance, recap/static-sheet reuse shared component)
- Create: `components/labs/snowpark/skills-summary.tsx` (server-compatible pure component)
- Modify: `e2e/labs-snowpark.spec.ts` (extend)

**Interfaces:**
- Consumes: `skills`, `skillCategories` from `@/data/skills` (fun excluded); existing recap layout.
- Produces: `<SkillsSummary />` — pure presentational component (no hooks) rendering the full grouped skill list (name, `{years} yrs · {level}`), used in THREE places: (1) server-rendered inside `page.tsx` within `<section aria-label="skills summary" className="sr-only">` so crawlers/ATS parse it without JS; (2) the reduced-motion static sheet; (3) the recap's full-list body (recap adds collected/missed ticks around it via a `marks` prop: `marks?: Map<string, 'collected' | 'missed'>`).

- [ ] **Step 1: Extract SkillsSummary + wire the three call sites**

Component renders semantic HTML (h2 `skills`, one h3 per category label, `ul > li` per skill: `<span>{name}</span> <span>{years} yrs · {level}</span>`, optional mark glyph `●`/`○` when `marks` provided). Page adds the sr-only section AFTER `<SnowparkGameLoader />` (server component — import is fine, no hooks). Reduced-motion sheet and recap replace their hand-rolled lists with it (visual classes via props kept minimal: `className` pass-through).

- [ ] **Step 2: Skip affordance**

Quiet fixed link bottom-left (mirrors the corner hint style, ink 60%, lowercase): `skip to the skills` — visible in 'playing' and 'paused'. Click → set phase to `'finished'`-style sheet WITHOUT a run: reuse the recap layout in a "sheet mode" (no run time/score header, no collected/missed marks, heading `skills` instead of `expedition log`, buttons `start the run` (fresh createRider → playing) and `← gallery`). Reduced-motion already renders this sheet — the skip target IS that component with the start button. Esc semantics: sheet is not 'playing', so input `setPlaying(false)` — Esc goes to the gallery (correct).

- [ ] **Step 3: Extend e2e**

Add to `e2e/labs-snowpark.spec.ts`:

```ts
test('skip path reaches the skills without playing', async ({ page }) => {
  await page.goto('/labs/snowpark')
  await expect(page.getByTestId('hud-score')).toBeVisible()
  await page.getByText('skip to the skills', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'skills' })).toBeVisible()
  await expect(page.getByText('React Native', { exact: true })).toBeVisible()
})

test('skill list is server-rendered for crawlers', async ({ request }) => {
  const res = await request.get('/labs/snowpark')
  const html = await res.text()
  expect(html).toContain('TypeScript')
  expect(html).toContain('skills summary')
})
```

- [ ] **Step 4: Run e2e + full unit; commit**

Run: `pnpm test:e2e -- labs-snowpark.spec.ts` (all projects) and `pnpm test:unit --run`.
Expected: all green including the v1 Esc/reduced-motion tests.

```bash
git add app/labs/snowpark/page.tsx components/labs/snowpark/skills-summary.tsx components/labs/snowpark/snowpark-game.tsx e2e/labs-snowpark.spec.ts
git commit -m "feat(snowpark): skip-to-skills path and crawlable server-rendered skill list"
```

### GATE E (ORCHESTRATOR): the resume lands

- [ ] Skip link is findable within 3 s but doesn't intrude on the game.
- [ ] Sheet/recap read as designed content in the new world (not v1's leftovers); collect cards + multiplier feel connected.
- [ ] `curl http://localhost:3000/labs/snowpark | grep TypeScript` hits (crawlable proof).
- [ ] First skill obstacle arrives within ~5 s of starting; first 30 s contains a kicker, a rail, and a full day-phase shift is underway.
- [ ] Ledger verdict.

---

# Milestone 6 — Polish and crescendo

### Task 12: Escalation, night glow, finish crescendo

**Files:**
- Modify: `components/labs/snowpark/render/terrain.ts` (marker/banner glow via `glow01`), `render/particles.ts` (chain-tier trail brightness), `render/sky.ts` (snowfall density already ramps — verify), `components/labs/snowpark/render/renderer.ts`

**Interfaces:**
- Consumes: `skyColors(p).glow01`, `chainTier` from Task 5.
- Produces: night-phase obstacle labels + collected dots + finish banner rendered with a soft amber halo scaled by `glow01` (radial gradient, radius 2× glyph, alpha ≤ 0.5·glow01); trail ribbon brightness lerps toward amber by chainTier; finish banner gains two ink posts with glowing amber banner line at night and a slow-down easing after crossing (rider decelerates to a stop over ~1.5 s before the recap opens — add `FINISH_DECEL = 300` to PHYS and ease in the finish mode instead of hard-stopping).

Also (spec: "each stretch shifts palette/props subtly"): per-stretch prop flavor — vary the Task 8 prop hash per stretch so each category stretch reads distinct: frontend face = denser pines; mobile ridge = rock spurs (angular ink polygons); state park = park banners (small ink flags on posts); styling bowl = sparse + wide bowl feel (props pulled back); backend flats = boulder clusters; tooling run-out = slalom-style gate poles. Same silhouette language, one variation each — no new colors.

- [ ] Implement, verify (tsc/lint/unit; rider finish test may need the easing accounted — update the "stops advancing" assertion to "stops within 2 s"), screenshot night stretch for the gate, commit `feat(snowpark): night glow, chain-lit trail, per-stretch props, finish crescendo`.

---

### Task 13: Poster + OG redraw in the new language

**Files:**
- Modify: `scripts/posters/snowpark-poster.html` (redraw), regenerate `public/labs/snowpark/poster.jpg` via existing `scripts/posters/capture-snowpark.mjs`

**Interfaces:** poster mirrors the new world: alpenglow-phase gradient sky, sun low, three hazed parallax bands, filled rim-lit snowline, the jointed rider mid-backflip with flowing amber scarf, `Powder Lines` wordmark + `STYLE LAB — № 2` caption. Only colors from the phase sets + anchors. 768×1024 ≤ 200 KB.

- [ ] Redraw the generator (canvas or SVG in the HTML, no external requests), run capture, `ls -la public/labs/snowpark/poster.jpg` ≤ 200 KB, eyeball in list view, commit `feat(snowpark): poster redrawn in the alpenglow language`.

### Task 14 (ORCHESTRATOR): GATE F — full run + gates + optional atmosphere pass

- [ ] Full-run playtest at 3 speeds (cautious, flowy, greedy): the 75–90 s arc holds; bails feel fair; "one more run" pull is real (play it 5×; if bored by run 3, diagnose and tune).
- [ ] Decide the optional WebGL atmosphere pass (soft bloom/grain): ONLY if the 2D stack hasn't hit the bar — if invoked, it's a new task appended by the orchestrator (full-screen fragment shader over the canvas, zero new deps).
- [ ] Mobile pass: touch controls (hold/flip/second-finger grab/swipe), DPR ≤ 2, 60 fps on a mid device via Chrome device emulation + real phone if available.
- [ ] All gates: `pnpm lint && pnpm exec tsc --noEmit && pnpm test:unit --run && pnpm build && pnpm test:e2e`.
- [ ] Anti-slop grep: `grep -rnE "EPIC|!{2,}" components/labs/snowpark/` → none; emoji scan on game copy → none.
- [ ] Final whole-branch review (most capable model) + single fix wave; ledger verdict; then superpowers:finishing-a-development-branch (update PR #5 — same branch).

## Final verification (whole branch)

- Unit ≥ 100 tests green (slope/course/rider/tricks/camera/sky/input/gallery-chrome); e2e green on 5 projects (canvas+HUD, Esc pause→exit, reduced motion, skip path, crawlable HTML).
- Spec pillar audit at GATE F: momentum currency, sub-100ms forgiveness, juice inventory live, camera instrument, atmosphere ingredients, front-loading, crawlable fallback, corrected de-slop rules.
- Human (user) plays the Vercel preview before merge — their word merges, nothing else.
