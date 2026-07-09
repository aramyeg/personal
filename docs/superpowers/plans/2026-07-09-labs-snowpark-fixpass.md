# Powder Lines Fix Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Address the user's v2 review: ramps must be real physics that change trajectory and produce air; the rider must have silhouette volume (not a stick figure); tricks must be a real vocabulary (flips ≠ spins, two grabs), not one button one trick.

**Architecture:** Three tasks on the existing engine + one orchestrator gate. Sim contract changes are pure and tested (kicker surface, flip/spin split); the rider redraw is render-only over the unchanged skeleton.

**Spec addendum to:** `docs/superpowers/specs/2026-07-09-labs-snowpark-redesign-design.md` (user-approved direction 2026-07-09: "Fix pass on this version"). Global Constraints of the redesign plan still bind (palette, copy, zero deps, Esc hardening, immutability, no Math.random).

## User's verdicts driving this pass (verbatim intent)

- "the ramps look very bad and they do not change the trajectory of the rider and do not produce more air" — kickers are currently draw-only; jumping on the footprint merely multiplies pop.
- "The stick figure still looks cheap" — line limbs + dot head lack volume.
- "there is essentially only 1 button and 1 trick which isn't really engaging" — spins/grabs neither read nor score distinctly.

---

### Task 1: Ramps are terrain — ride up, launch off the lip

**Files:**
- Modify: `components/labs/snowpark/rider.ts` (kicker surface participation)
- Modify: `components/labs/snowpark/render/renderer.ts` (drawKicker: filled, snow-capped, fused into the snowline)
- Test: `__tests__/labs/snowpark/rider.test.ts` (extend)

**Interfaces:**
- Produces: `kickerSurfaceY(o: CourseObstacle, x: number): number` and `kickerFaceAngle(o: CourseObstacle): number` exported from rider.ts; `PHYS.LIP_RAISE = 80` (replaces the draw-only 34); `KICKER_BOOST` is RETIRED (the lip IS the boost) — remove from PHYS.

- [ ] **Step 1: Surface model (binding)**

Kicker face = straight ramp from `(o.x, slopeY(o.x))` to `(o.x + o.length, slopeY(o.x + o.length) - PHYS.LIP_RAISE)`. With LIP_RAISE 80 over length 120 against base grade ~0.38, the face gradient ≈ (46 − 80)/120 ≈ −0.28 → the lip points UP ~16° in world terms — riding it at speed produces real air with no button.

```ts
export function kickerSurfaceY(o: CourseObstacle, x: number): number {
  const t = clamp((x - o.x) / o.length, 0, 1)
  const y0 = slopeY(o.x)
  const y1 = slopeY(o.x + o.length) - PHYS.LIP_RAISE
  return y0 + (y1 - y0) * t
}
export function kickerFaceAngle(o: CourseObstacle): number {
  return Math.atan((slopeY(o.x + o.length) - PHYS.LIP_RAISE - slopeY(o.x)) / o.length)
}
```

- [ ] **Step 2: Snow-mode participation (binding contract)**

In `stepSnow`, when x is inside a kicker footprint: the ACTIVE surface is the kicker face — `y = kickerSurfaceY`, and the angle used for pull/drag/advance/pop/launchAngleDeg is `kickerFaceAngle(o)` (climbing the face bleeds speed naturally via the negative sin — that IS the risk/reward: hit ramps fast or crawl off them). Crossing the lip (x > o.x + o.length while the previous frame was on the face) → airborne with velocity along the face (vy negative at speed), `justLaunched`, coyote opens, `attributedObstacle = kicker index`. Jump pressed on the face → pop along the face normal (existing pop code with face angle) — stacks with the lip. Entry is continuous (face starts at snow level). Grind/rail/box logic untouched. Remove the old KICKER_BOOST branch entirely.

- [ ] **Step 3: Tests (real behavior)**

(a) riding a kicker at cruise WITHOUT jumping → mode becomes air past the lip with vy < 0 and attribution set; (b) landing that air clean with any rotation ≥ 0 banks the kicker's skill (an Ollie counts — the air was earned); (c) the same crest without a kicker does not launch at cruise (contrast test); (d) climbing the face bleeds speed (speed at lip < speed at entry for an untucked cruise approach); (e) kickerSurfaceY endpoints exact.

- [ ] **Step 4: Filled wedge draw**

drawKicker: filled polygon (entry → lip → lip base → close) filled `colors.snow` body-gradient family with ink outline 2px and the rim-light stroke along the FACE edge (same mix as the snowline rim); lip post edge ink. It must read as packed snow fused to the slope, not a hollow outline.

- [ ] **Step 5: Suites + commit**

`pnpm vitest --project unit __tests__/labs/snowpark/rider.test.ts --run` then full unit + tsc + lint. Commit `feat(snowpark): kickers are rideable geometry - real air off the lip`.

---

### Task 2: Rider silhouette — volume over the same skeleton

**Files:**
- Modify: `components/labs/snowpark/render/rider-rig.ts` (draw pass only; poses/joints/scarf anchor unchanged)

**Interfaces:** unchanged exports; RIG gains `TORSO_W: 10`, `LIMB_W: 4.5`, `BOARD_THICK: 7`.

- [ ] **Step 1: Redraw with fills (binding character direction)**

Keep the exact joint skeleton and poses. Replace line strokes with filled volume: torso = filled parka quad (shoulder width ~TORSO_W tapering to hips, slight back curve — a poncho mass like Alto's rider), head = filled disc slightly larger (6.2) with a small beanie wedge, legs = tapered filled limbs (hip 4.5 → ankle 3), arms tapered (4 → 2.5), board = filled rounded slab BOARD_THICK with the snow deck line. All ink; scarf unchanged amber. Bail pieces reuse the same filled primitives. lineCap/join stay owned. No new colors.

- [ ] **Step 2: Verify + commit**

tsc + lint + rig tests green (pose invariants untouched). Screenshot for GATE G. Commit `feat(snowpark): rider gains silhouette volume - parka mass, tapered limbs, board slab`.

---

### Task 3: A real trick vocabulary — flips ≠ spins, two grabs

**Files:**
- Modify: `components/labs/snowpark/rider.ts` (rotation split), `components/labs/snowpark/input.ts` (ArrowDown = tail grab), `components/labs/snowpark/tricks.ts` (naming/scoring), `components/labs/snowpark/render/rider-rig.ts` (spin render + grab poses)
- Test: extend rider + tricks tests; input.test.ts compile-safe

**Interfaces (binding):**
- `RiderInput`: `grabHeld` → `grab: 'none' | 'nose' | 'tail'` (ArrowUp nose, ArrowDown tail; ArrowDown loses nothing — it was unbound).
- `RiderState`: `rotationDeg` splits into `flipDeg` (Space-held, SPIN_RATE 420) and `spinDeg` (←/→-held, SPIN_RATE_SPIN 300). Board angle for landing = `launchAngleDeg + flipDeg` (flips pitch the board; spins do not). Spins must SETTLE to a multiple of 360 within SNAP_DEG at landing or the landing is scrubbed (not bailed — spins are lower risk, lower pay).
- `TrickInput`: `{ flipDeg, spinDeg, grab: 'none'|'nose'|'tail', grindLength, late }`. Scoring: PER_180 flips 150; PER_360 spins 180; grabs 120 each. Naming (dry, composable): flips `Backflip` / `Double Backflip` (per full 360 of flip... a full backflip = 360 pitch; 180 flip lands switch — name `180`), spins `360` / `720`, grabs `Nose Grab` / `Tail Grab`, grind `+ Grind`. Examples binding: `Backflip Tail Grab — React · 8 yrs · expert`, `360 Nose Grab — TypeScript · 6 yrs · expert` (the spec's exact example string still parses under the new namer: spin 360 + nose grab).
- Rig: spins render as horizontal squash of the whole figure (|cos(spinDeg)| X-scale, min 0.25 — the silhouette turning through profile) while flips rotate the board+figure; nose grab arm reaches to the nose, tail grab reaches back to the tail (distinct poses).

- [ ] **Step 1: Tests first** — naming table (the two binding examples + `Backflip 360 Nose Grab + Grind` composite), scoring arithmetic per component, spin-settle scrub vs flip-offset bail distinction, tail grab latch.
- [ ] **Step 2: Implement across the four files; keep every existing test green (update mechanically where the shape changed).**
- [ ] **Step 3: Full unit + tsc + lint + e2e labs-snowpark spec. Commit `feat(snowpark): trick vocabulary - flips vs spins, nose and tail grabs`.**

---

### GATE G (ORCHESTRATOR): the fix pass answers the review

- [ ] Riding a kicker at speed launches with visibly changed trajectory and real air — no button. Kickers read as packed-snow ramps fused to the slope.
- [ ] The rider reads as a figure with mass at gameplay zoom and in the poster-scale zoom check; no stick-figure read at any day phase.
- [ ] Three distinct trick families visibly differ mid-air (flip rotation vs spin profile-turn vs grab poses) and produce different names/scores in the HUD and collect cards.
- [ ] Full gates: lint, tsc, unit, build, e2e labs-snowpark.
- [ ] Ledger verdict; push; PR comment summarizing the pass; hand to user for preview.
