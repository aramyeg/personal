# Research: character-walks-on-a-tiny-rotating-planet + scroll-driven r3f timeline

## TL;DR — recommended architecture

1. **Don't move the character across the sphere. Rotate the sphere (planet group) under a fixed character.** This is the "pivot around sphere center" pattern confirmed working in production three.js/r3f threads — it sidesteps the pole singularity that breaks tangent-plane / lookAt-based approaches entirely. Concretely:
   - `<group ref={planetGroup}>` holds the terrain mesh, props, decorations.
   - The character mesh sits at a **fixed local position** just above the world origin (e.g. `[0, 0, radius]`), always "on top" of the sphere from the camera's point of view, walking in place or with a small in-place stride animation.
   - "Walking forward" = rotate `planetGroup` around the character's local right axis. "Turning" = rotate `planetGroup` around the character's local up axis (the axis through the character and the sphere center). Both rotations are applied as **quaternion pre-multiplies on the planet group**, not on the character.
   - Anchored props (trees, houses, comic-panel markers) are children of `planetGroup`, placed with `setFromSphericalCoords` and oriented outward with `quaternion.setFromUnitVectors(defaultUp, radialNormal)` — computed once at placement time, not per frame.
   - This is exactly the fix in the three.js forum thread ["Issue with Character Movement Near South Pole"](https://discourse.threejs.org/t/issue-with-character-movement-near-south-pole-in-three-js/58349), reference implementation: [CodePen by @boytchev](https://codepen.io/boytchev/pen/oNmEQjO).

2. **Drive `planetGroup` rotation from scroll progress**, not from keyboard/pointer input, since this is a scrollytelling piece. Get raw scroll progress from **native document scroll + a sticky viewport** (not drei `ScrollControls`), because the brief requires accessible, selectable HTML comic-panel overlays coexisting with the WebGL layer and native mobile scrollbar behavior. `ScrollControls` hijacks the scroll container specifically to solve DOM/WebGL sync, which fights you when the DOM content itself must be normal, accessible page content.

3. **Smooth the raw scroll progress with exponential/frame-rate-independent damping** (`maath/easing`'s `damp`/`dampAngle`, or the Unity-`SmoothDamp` formula `value = lerp(value, target, 1 - exp(-lambda * dt))`) before feeding it into the planet's rotation quaternion. Never use a plain `lerp(a, b, 0.1)` per frame — it's frame-rate dependent and will visibly change speed between 60/120/144Hz displays.

4. **Sync stride cadence to angular velocity, not to elapsed time**, using the rolling-without-slipping relationship `ω = v / r` (arc length = radius × angle in radians). Compute the planet's *linear* surface speed under the character's feet each frame (`v = angularVelocity * radius`), then drive the walk-cycle's playback rate proportionally to `v`, so foot strikes line up with a constant stride length regardless of scroll speed.

5. **For chapter stops**, prefer JS-driven eased "virtual scroll" windows (progress-per-chapter ranges you compute yourself, e.g. via `useScroll().range()` equivalent logic on raw scrollTop) over `scroll-snap-type: mandatory`. CSS scroll-snap is zero-JS and keeps native scrollbar behavior, but `mandatory` can trap users on tall sections and has no reliable native "dwell" concept; `proximity` is safer but weaker. Given the sphere rotation needs continuous fractional progress (not discrete section jumps), a smoothed continuous progress value with softly-clamped "dwell plateaus" in your progress-to-rotation mapping function will read better than hard snapping.

---

## 1. Fixed character, rotating planet — transform hierarchy

### The core problem
Two naive approaches both break:
- **Move the character across the sphere surface** (recompute position via spherical coords + orient via `lookAt`/quaternion each frame) → breaks down near the poles. A three.js forum user hit exactly this: the character got "locked in a sort of orbital movement around the south pole" ([source](https://discourse.threejs.org/t/issue-with-character-movement-near-south-pole-in-three-js/58349)). This is a rotational-singularity problem, structurally similar to gimbal lock, caused by recomputing an "up" vector from a position vector that approaches a pole.
- **Orient props with `lookAt`**: works for one-off orientation but its up-vector handling is inconsistent for continuous per-frame reorientation — commonly cited as broken/surprising in r3f (["Why lookAt is not working in react-three-fiber mesh?"](https://discourse.threejs.org/t/why-lookat-is-not-working-in-react-three-fiber-mesh/42894)).

### The fix that works: rotate the world, not the walker
[PavelBoytchev's solution](https://discourse.threejs.org/t/issue-with-character-movement-near-south-pole-in-three-js/58349) ([CodePen](https://codepen.io/boytchev/pen/oNmEQjO)) reframes the problem entirely: instead of computing where the character should be on the sphere, **the character's local transform never changes**. Only the sphere (or a parent group containing the whole planet's geometry) rotates:

- "Going forward" = rotate the planet group around the character's local **right/side axis** (perpendicular to walk direction, tangent to the sphere at the character's fixed point).
- "Turning left/right" = rotate the planet group around the character's local **up axis** (the radial line from sphere center through the character).

Both are local axes of the character (which never moves), so there's no singularity — the character is always "at the top" of its own local frame, and the planet just spins underneath in whatever direction is needed. This eliminates polar gimbal lock completely, because you never parametrize position by (phi, theta) that degenerates at the poles; you only ever apply incremental rotations around two orthogonal axes attached to a fixed point.

```js
// Conceptual react-three-fiber structure
function TinyPlanetScene() {
  const planetGroup = useRef()
  const forwardAxis = useRef(new THREE.Vector3(1, 0, 0))  // character's local "right"
  const turnAxis = useRef(new THREE.Vector3(0, 1, 0))     // character's local "up" (radial)

  useFrame((_, delta) => {
    const forwardSpeed = getWalkSpeed()   // driven by damped scroll progress, see §3/§5
    const turnRate = getTurnRate()

    // Rotate the planet around axes fixed to the (stationary) character.
    const qForward = new THREE.Quaternion().setFromAxisAngle(forwardAxis.current, forwardSpeed * delta)
    const qTurn = new THREE.Quaternion().setFromAxisAngle(turnAxis.current, turnRate * delta)

    planetGroup.current.quaternion.premultiply(qForward).premultiply(qTurn)
  })

  return (
    <>
      <group ref={planetGroup}>
        <PlanetTerrain />
        <AnchoredProps />  {/* trees, comic markers, buildings */}
      </group>
      <CharacterRig position={[0, 0, PLANET_RADIUS]} />  {/* never moves */}
    </>
  )
}
```

### Anchoring props at a given latitude/longitude
For static decoration (trees, comic panel triggers, buildings) placed once on the sphere and then carried along for free by the planet's own rotation, use spherical coordinates for position and `setFromUnitVectors` for outward orientation — confirmed pattern from [three.js forum "Orientation of objects on a sphere surface"](https://discourse.threejs.org/t/orientation-of-objects-on-a-sphere-surface/28220):

```js
function placeOnSphere(mesh, radius, phi, theta) {
  mesh.position.setFromSphericalCoords(radius, phi, theta)

  const radialNormal = mesh.position.clone().normalize()
  const defaultUp = new THREE.Vector3(0, 1, 0) // the mesh's own "up" in its authored orientation
  mesh.quaternion.setFromUnitVectors(defaultUp, radialNormal)
}
```

This is a one-time placement computation (do it in `useMemo`/on mount), not a per-frame operation — the props then move rigidly with `planetGroup`'s rotation for free, with zero extra per-frame math.

**Key architectural takeaway:** anchoring is cheap (do it once, parent to the rotating group); locomotion is the hard part, and the trick is to never re-anchor the character — only ever rotate the world around it.

---

## 2. Foot-contact sync: stride cadence ↔ angular velocity

There isn't sphere-specific published material on this, but the underlying physics is the standard **rolling-without-slipping** constraint used for wheel/vehicle animation, which transfers directly:

- Arc length traveled = `radius × angle_in_radians` (`x = Rθ`)
- Differentiating: linear surface speed `v = ω × R`, i.e. `ω = v / R`

Applied to a walking figure fixed at the top of a rotating planet: the "linear speed" the character's feet must appear to move at is the **surface speed of the planet passing beneath them**, i.e. `v = angularVelocityOfPlanet × PLANET_RADIUS`. The walk cycle's playback rate should scale with `v`, not with wall-clock time, so that:

- Stride length (distance covered by one footfall cycle, measured from your rigged animation's root motion) stays visually **constant** in world units regardless of how fast the user scrolls.
- Animation playback rate = `v / strideLength` (cycles per second), so a faster scroll (bigger `ω`) speeds up the leg animation, not just the planet's spin — avoiding the classic "moonwalk"/foot-sliding artifact where feet appear to glide because playback rate and translation speed have drifted apart. This mirrors the standard game-dev fix for foot sliding: mismatches between root motion speed and configured movement speed are the most common cause of sliding feet in shipped games; the fix is always to measure actual per-cycle displacement and drive animation rate from real movement speed, never from a fixed/guessed rate.

```js
useFrame((_, delta) => {
  const omega = getDampedAngularVelocity() // rad/s, from smoothed scroll progress derivative
  const surfaceSpeed = omega * PLANET_RADIUS // v = ω r

  const cyclesPerSecond = surfaceSpeed / STRIDE_LENGTH
  mixer.timeScale = cyclesPerSecond / walkClip.baseCyclesPerSecond // normalize to authored clip speed

  // Also drive the planet's own spin from the same omega, so terrain and legs never desync:
  planetGroup.current.rotateOnAxis(forwardAxis, omega * delta)
})
```

Practical notes:
- Derive `omega` as the **time-derivative of the damped scroll progress**, not the raw scroll delta — otherwise a single mouse-wheel tick will cause a visible leg-speed pop even though the planet itself is smoothly damped (see §5 on deriving from smoothed rather than raw input).
- Clamp `cyclesPerSecond` to a minimum so legs don't literally freeze mid-stride when scroll velocity hits zero — cross-fade to an idle/breathing pose below a speed threshold instead of setting `timeScale` to 0.
- If stride length isn't available from motion-capture root-motion data, treat it as a tunable constant per character and expose it in a debug panel; it's the single biggest lever for eliminating sliding.

---

## 3. Scroll-driven timelines in r3f: native scroll vs `ScrollControls`

### `@react-three/drei`'s `ScrollControls`
- Creates its **own HTML scroll container in front of the canvas** and listens to scroll events on that container (not the page's native scroll) — [drei docs](http://drei.docs.pmnd.rs/controls/scroll-controls), [Wawa Sensei walkthrough](https://wawasensei.dev/courses/react-three-fiber/lessons/scroll).
- Gives you `useScroll()` with `offset`, `delta`, `range()`, `curve()`, `visible()` helpers for driving 3D scene state from scroll position — very convenient for the "page-count" mental model (`pages={5}` = 5×100vh).
- A `<Scroll html>` wrapper lets you render DOM children that scroll in lockstep with the 3D scene, but there are **known issues layering `Html` content correctly inside/outside the ScrollControls container** ([GitHub issue #1048](https://github.com/pmndrs/drei/issues/1048), [three.js forum thread](https://discourse.threejs.org/t/scrollcontrols-issue-when-using-dreis-html-helper/32346)) — this is the exact failure mode the brief is worried about (comic panels as real, selectable HTML).
- Because it owns the scroll container, it can complicate: native mobile scroll physics/scrollbar affordances, browser find-in-page, screen-reader landmark/scroll behavior, and anchor links — all of which are easier to reason about when the browser's real document scroll is left alone.

### Native document scroll + sticky viewport (recommended for this project)
- Keep the Canvas `position: sticky; top: 0; height: 100vh` inside a tall content wrapper (e.g. `height: 500vh` for 5 "scenes"), and read `window.scrollY` / an `IntersectionObserver`-driven progress value yourself, mapping it to `[0,1]` per chapter.
- Comic-panel HTML content lives as **normal DOM siblings in page flow**, fully accessible (real elements, real focus order, selectable text, works with browser zoom/find), not funneled through a drei `Html` portal.
- Because the canvas is `position: sticky` rather than `fixed`, mobile Safari's/Chrome's native scrollbar, rubber-banding, and momentum scroll all behave exactly as users expect — no scroll hijacking, no fighting the browser's own touch/wheel handling.
- Downside vs `ScrollControls`: you write your own progress-normalization and easing (see §5) instead of getting `useScroll()` for free — but that's a small amount of code, and it buys full control over per-chapter easing/dwell behavior that `ScrollControls`' generic page model doesn't give you either.
- The libraries in this space that specifically solve DOM/WebGL sync (`@14islands/r3f-scroll-rig`, using **Lenis** under the hood) confirm the core tension: "native scroll causes a delay and jittering between HTML and WebGL layers" when you read raw `scrollY` directly in `useFrame`, which is why a damping layer (§5) between raw scroll and the value driving Three.js is what actually fixes jitter — not scroll-hijacking. Lenis itself is explicitly built to "wrap the browser's own scroll so `position: sticky`, anchor links, and accessibility keep working," and ships a snap plugin that "aligns sections without fighting the smooth scroll," which is the right building block if damped-native-scroll ends up feeling too "loose" and you want lightweight snap-assist without going full `ScrollControls`.

**Recommendation:** native scroll + sticky canvas + your own damped progress hook, optionally with Lenis as a drop-in "smooth native scroll" layer if you want inertia without losing `position: sticky`/accessibility. Reserve `ScrollControls` for scenes where all content is inside the canvas (no real DOM overlay requirement) — not the case here.

---

## 4. Chapter stops: scroll-snap vs eased virtual scroll vs progress windows

| Approach | How it works | Jank/UX risk | Fit for this project |
|---|---|---|---|
| **CSS `scroll-snap-type: mandatory`** | Browser auto-aligns to `scroll-snap-align` elements natively, zero JS | Can trap users on tall sections (unreachable middle content); "jumping to seemingly arbitrary points" reported as jarring on desktop ([CSS-Tricks](https://css-tricks.com/practical-css-scroll-snapping/)); `scroll-snap-stop: always` (force a stop before continuing) has historically weak/inconsistent browser support | Poor fit — the sphere needs continuous fractional rotation, not discrete jumps between chapters |
| **CSS `scroll-snap-type: proximity`** | Snaps only near a snap point, otherwise free scroll | Much gentler, native-feeling, no scroll-jacking since the browser's own snap animation is used | Reasonable as a light assist, but still discrete — doesn't express "dwell" (linger without progressing) |
| **Eased/virtual scroll (Lenis, GSAP ScrollTrigger scrub)** | JS intercepts scroll input, applies easing/inertia, scrubs a timeline to a smoothed progress value | Flexible per-chapter easing and true "dwell" (progress curve can flatten for N vh of physical scroll); risk of feeling unresponsive/laggy if smoothing is too heavy, and can fight native scrollbar/momentum if implemented as full scroll-jacking rather than "wrap-and-smooth" (Lenis explicitly avoids hijacking) | **Best fit** — lets you build literal dwell plateaus into the progress-to-rotation mapping function (flat region of the curve = plenty of physical scroll distance maps to almost no rotation change = a "chapter stop" that still allows free scroll-away) |
| **Plain progress windows (`range()`-style, no easing)** | Each chapter owns a `[start, end]` scrollY range; progress within it maps 0→1 linearly, no snapping at all | No jank at all (nothing artificial happens to scroll), but transitions between chapters can feel abrupt/linear rather than "settling" | Good baseline; combine with §5 damping on top so raw progress is smoothed before use, giving you dwell-like settling without any snap logic |

**Recommendation:** build chapters as **plain progress windows** (you already need per-chapter `[start,end]` mapping to know which comic panel is "active"), then run the resulting progress value through the damping function from §5 before it drives rotation. Where you want an actual "dwell" feel (planet visibly pauses spinning while comic panel is fully in view), author that directly into your progress-to-rotation **curve** (e.g. an ease that flattens near chapter midpoints) rather than reaching for CSS scroll-snap or scroll-jacking libraries — this keeps native scroll physics completely intact while still delivering the narrative pacing.

---

## 5. Frame-rate-independent damping for scroll progress

**Never do this** (frame-rate dependent — same "0.1" lerp factor produces different real-world smoothing speed at 30fps vs 144fps):
```js
smoothed = THREE.MathUtils.lerp(smoothed, target, 0.1) // BAD if called once per rendered frame
```

**Do this instead** — exponential decay parametrized by a half-life/`lambda` and real elapsed `delta`, so the same visual smoothing speed holds at any frame rate ([Rory Driscoll, "Frame Rate Independent Damping Using Lerp"](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/)):

```js
// value = lerp(value, target, 1 - exp(-lambda * dt))
// lambda = 1.0 => moves halfway to target each second; double lambda => twice as fast
function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}
```

`three.js` ships this natively as `THREE.MathUtils.damp(x, y, lambda, dt)`, and `maath/easing` (from the `pmndrs` ecosystem already used by drei/r3f) wraps the same idea for vectors/angles with a more game-engine-flavored API (`smoothTime` instead of `lambda`, plus `maxSpeed` clamping and shortest-path angle handling):

```js
import { damp, damp3, dampAngle } from 'maath/easing'

useFrame((_, delta) => {
  // Scalar scroll progress:
  damp(scrollState, 'smoothedProgress', rawScrollProgress, 0.25, delta)

  // A 3D vector (e.g. camera offset driven by progress):
  damp3(cameraOffset, targetOffset, 0.25, delta)

  // An angle, taking the shortest rotational path (avoids the 359°→0° wraparound jump):
  dampAngle(rotationState, 'angle', targetAngle, 0.25, delta)
})
```

Practical guidance for this project:
- Read raw scroll progress from `window.scrollY` (or an `IntersectionObserver`/`ResizeObserver`-based measurement) in a scroll listener or `useFrame`, store it as the *target*.
- Maintain a separate *smoothed* value updated every frame via `damp`/`maath`'s `damp`, and drive **all** visual consequences (planet rotation, camera moves, comic panel opacity) from the smoothed value, never the raw one.
- Derive angular velocity (§2) as `(smoothedProgress_thisFrame - smoothedProgress_lastFrame) / delta` — differentiating the already-smoothed signal avoids the single-wheel-tick pop you'd get differentiating raw scroll deltas directly.
- Pick `smoothTime`/`lambda` by feel: `smoothTime ≈ 0.15–0.3s` (`lambda ≈ 3–7`) is a common comfortable range for scroll-driven camera/rotation work — small enough to feel responsive, large enough to erase mouse-wheel/trackpad stutter.
- If you need a hard ceiling on how fast the planet can spin during a fast fling-scroll (so legs/animation never has to snap to a ridiculous cycle rate), use `maath`'s `maxSpeed` parameter on `damp3`/`dampAngle` rather than clamping the raw target — clamping the *rate of change* (not the target itself) keeps the eventual resting position correct while capping peak angular velocity.

---

## Sources

- [three.js forum: Issue with Character Movement Near South Pole in Three.js](https://discourse.threejs.org/t/issue-with-character-movement-near-south-pole-in-three-js/58349) — the core "rotate the planet around the character's fixed local axes" fix
- [CodePen: boytchev/pen/oNmEQjO](https://codepen.io/boytchev/pen/oNmEQjO) — working reference implementation of the above
- [three.js forum: Orientation of objects on a sphere surface](https://discourse.threejs.org/t/orientation-of-objects-on-a-sphere-surface/28220) — `setFromSphericalCoords` + `quaternion.setFromUnitVectors` prop-anchoring pattern
- [three.js forum: Why lookAt is not working in react-three-fiber mesh?](https://discourse.threejs.org/t/why-lookat-is-not-working-in-react-three-fiber-mesh/42894) — why continuous per-frame `lookAt` is unreliable
- [three.js forum: [SOLVED] "Little Planet" Animation](https://discourse.threejs.org/t/solved-little-planet-animation/59486) — alternative camera-controls-based little-planet approach (less relevant, camera-only)
- [MoCap Online: Walk Cycle Animation — Game Engine Integration Guide](https://mocaponline.com/blogs/mocap-news/walk-cycle-animation) — root-motion/speed-mismatch cause of foot sliding
- [Real World Physics Problems: Rolling Without Slipping](https://www.real-world-physics-problems.com/rolling-without-slipping.html) — `v = ωR` derivation used for stride/angular-velocity sync
- [drei docs: ScrollControls](http://drei.docs.pmnd.rs/controls/scroll-controls) — API and page-count model
- [Wawa Sensei: Scroll (React Three Fiber course)](https://wawasensei.dev/courses/react-three-fiber/lessons/scroll) — `ScrollControls`/`Scroll`/`useScroll` code patterns
- [drei GitHub issue #1048: ScrollControls scroll Html element even outside of `<Scroll>`](https://github.com/pmndrs/drei/issues/1048) — known HTML-overlay/z-order pitfalls
- [three.js forum: ScrollControls issue when using Drei's Html helper](https://discourse.threejs.org/t/scrollcontrolls-issue-when-using-dreis-html-helper/32346)
- [GitHub: 14islands/r3f-scroll-rig](https://github.com/14islands/r3f-scroll-rig) — DOM/WebGL proxy-element sync via Lenis, "native scroll causes jitter" problem statement
- [Lenis](https://www.lenis.dev/) / [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) — wraps native scroll (keeps `position: sticky`/accessibility), includes a snap plugin
- [CSS-Tricks: Practical CSS Scroll Snapping](https://css-tricks.com/practical-css-scroll-snapping/) — `scroll-snap-type`/`-align`/`-stop` semantics and UX pitfalls
- [MDN: Basic concepts of scroll snap](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap/Basic_concepts)
- [MDN: scroll-snap-stop](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop)
- [Rory Driscoll: Frame Rate Independent Damping Using Lerp](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/) — the `1 - exp(-lambda*dt)` derivation
- [three.js docs: MathUtils.damp](https://threejs.org/docs/#api/en/math/MathUtils.damp) — built-in frame-rate-independent damp
- [pmndrs/maath README](https://github.com/pmndrs/maath/blob/main/README.md) — `damp`/`damp3`/`dampAngle` API (Unity `SmoothDamp`-style, refresh-rate independent, `maxSpeed`/`eps` params)
- [pmndrs/maath issue #33: damp3 and easing function](https://github.com/pmndrs/maath/issues/33)
