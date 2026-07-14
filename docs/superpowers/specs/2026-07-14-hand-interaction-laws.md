# The Hand — interaction laws (D6)

2026-07-14. The gesture layer for P5 (pull/push tabs, knob rotation,
keepsake removal). Companion to the D6 derive benches
(`derive-userdrive`, `derive-knobtower`, `derive-keepsake`); numeric
constants owed by a bench are marked [bench]. Standing rulings this
spec must never violate: NO deep tilt (hover parallax only); any new
pointer gesture must be disambiguated against the swipe grammar in
`use-book-input.ts` (the drag-to-tilt v1 revert is the precedent);
explicit affordance — every grabbable surface reads as a handle.

## Law H1 — hit-target disambiguation (the master rule)

A grab begins ONLY on a `pointerdown` whose ray hits a handle mesh
(tab quad, knob disc, keepsake tab). Gesture SHAPE never
disambiguates — no hold-to-grab, no modifier keys, no drag-direction
heuristics. Everything that starts off-handle remains a swipe/turn
gesture, untouched. This is the explicit-affordance law made
mechanical: the handle set is exactly the interactive surface set.

Enforcement order (why this is race-free): r3f attaches its pointer
handlers to the canvas element, and `use-book-input.ts` listens on
`window` without capture — the canvas handler runs first on the
bubble path. The r3f `onPointerDown` on a handle sets the store's
grab state; the window `pointerdown` handler then sees an active grab
and RECORDS NO SWIPE START. Suppress at start, not at end: since no
start was recorded, the later `pointerup` cannot fire a turn no
matter which handler releases the grab first.

## Law H2 — grab lifecycle

- Grab is legal only when `booted && turning === null` and the host
  spread is the current one at settled rest ([bench] the userdrive
  derive rules on the exact near-rest window).
- On grab: pointer capture on the canvas element; store records
  `{ id, kind }` (kind: 'tab' | 'knob' | 'keepsake'); cursor
  `grabbing` (hover over any handle shows `grab`).
- High-frequency scrub values (s, theta) NEVER flow through React
  state — they live in a mutable module-level channel read by the
  frame loop; zustand holds only the low-frequency grab identity.
- On release (pointerup/pointercancel/blur): the piece's return law
  takes over ([bench] bounded by GLOBAL_CAP).
- A turn request arriving mid-grab (keyboard/wheel — pointer swipe
  cannot, per H1) force-releases the grab, then the turn proceeds;
  the composed release-during-turn trajectory is a userdrive bench
  gate. Turns are never blocked by a grab (hostile UX), with the one
  keepsake exception ruled by the seat law ([bench]).

## Law H3 — linear handle (pull/push tabs)

Direct manipulation in the strip domain: each frame, intersect the
pointer ray with the host PAGE PLANE (recomputed from the live page
frame, so parallax tilt cannot desync it), project the hit onto the
strip axis (the page-frame u direction), and take the displacement
since grab: `s_user = clamp(s_atGrab + Δd, 0, s_stop)`. The tab
tracks the finger's projection exactly — the paper does whatever the
slide law dictates. No easing while grabbed (the hand IS the clock);
easing exists only in the release return law.

## Law H4 — rotation handle (the knob)

Rotation gets a real handle, not an invisible gesture: the knob disc
carries a printed/die-cut thumb notch and a short arrow arc so
twisting reads before touching. While grabbed: intersect the pointer
ray with the knob's seat plane, measure the angle about the hub
center, accumulate per-frame deltas wrapped to (-pi, pi]. Stability
guard: deltas measured from hit points inside 0.25·r of the hub are
discarded (angle is numerically unstable at the center; the last
stable angle holds). theta clamps to the working range
[0, THETA_MAX], THETA_MAX = acos(1 - s_full/crankR) per piece with a
270-degree ergonomic covenant ceiling (derive-knobtower K7: the
recommended config wants 141.2deg — one comfortable drag). Release
holds theta PERMANENTLY: the coplanar disc holds the twist through
page turns and even book close/reopen, because the fold-flat
composition law a_shown = a(theta) * E(beta) collapses every tier
exactly at close for ANY frozen theta (derive K1, exact). The book
remembers the knob; nothing ever homes autonomously.

## Law H5 — the stage holds still under the hand

While any grab is active, the parallax rig freezes its ease target at
the current tilt (a target wobbling under the finger corrupts H3/H4
projections and reads as the book squirming away). Hover parallax
resumes on release. This is a freeze, not a snap — the rig simply
stops chasing the pointer.

## Law H6 — touch parity

Pointer events unify mouse/touch. On touch there is no hover cue, so
handles must read as grabbable from shape alone: the kraft tab with
grip notch (shipped) and the knob's thumb notch (H4) are the
affordance, not the cursor. Hit targets get a small raycast slop on
coarse pointers ([impl] pointerType === 'touch' widens the handle
quad by ~1.5x for hit purposes only).

## Law H7 — keepsake grammar distinction

Pull-to-erect (tabpiece) and pull-to-REMOVE (keepsake) must not share
a visual grammar: the keepsake reads as a loose card in a pocket
(corner peeking, different tab silhouette) per the keepsake derive's
affordance section. One gesture, two verbs, disambiguated by what
the paper visibly is — never by hidden state.
