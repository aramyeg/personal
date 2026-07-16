# Stylized skip/hop animation on a Meshy/Mixamo character in three.js / R3F

## TL;DR — recommended pipeline

1. **Character**: If the mesh comes from Meshy, auto-rig it *in Meshy itself* (Meshy has its own auto-rigger; it does not push to Mixamo) — **or** export the Meshy mesh as FBX/OBJ in T-pose and drag it into **mixamo.com**'s "Upload Character" auto-rigger to get a Mixamo skeleton. The second path is the one that lets you use Mixamo's animation library directly with zero retargeting math, because the character now *is* a Mixamo skeleton. This is the path to prefer for this project.
2. **Animation source**: pick clips from Mixamo's library on the rigged character (see "Clip catalog" section — exact happy-skip clip names could not be confirmed from outside Mixamo's authenticated UI; search Mixamo directly for `skip`, `hop`, `jump`, `cheer`, `excited`, `jubilant`). Download each clip as **FBX, "without skin," 30fps**, with **"In Place" enabled** in the Mixamo preview panel wherever the clip supports it — this removes root motion at the source and avoids doing it manually in three.js.
3. **If the character is NOT a Mixamo skeleton** (e.g., you kept Meshy's own auto-rig, or use a hand-authored rig): use `three/examples/jsm/utils/SkeletonUtils.js`'s `retargetClip(targetObject, sourceObject, clip, options)` to map the Mixamo FBX clip onto your skeleton at runtime, OR do the retarget once, offline, in Blender (Auto-Rig Pro's Remap, or the free `Mixamo Rig` / `Expy-Kit` add-ons) and bake a single GLB with all clips embedded — the offline route is more reliable (see gotchas below).
4. **Playback in R3F**: load the GLB(s) with `useGLTF`, get `{ actions, mixer }` from `@react-three/drei`'s `useAnimations(animations, group)`, and crossfade between clips with the standard three.js pattern: `action.reset().fadeIn(duration).play()` on the incoming clip and `previous.fadeOut(duration)` on the outgoing one (`action.crossFadeTo(nextAction, duration, true)` also works and is what the official three.js example uses).
5. **Speed from scroll**: drive `mixer.timeScale` (or per-action `action.timeScale`) every frame from your scroll-velocity signal inside `useFrame`, clamped to a sane range (e.g. `0.2–2.0`) so the skip cycle visibly speeds up/slows down with scroll speed without ever reversing or freezing.

Everything above is standard, verifiable three.js/drei API except the exact Mixamo clip names, which are behind an authenticated catalog I could not browse — flagged clearly below.

---

## 1. Mixamo clip catalog for a "happy skip"

**Unverified — could not confirm from outside Mixamo's authenticated web app.** Web search and fetch tools cannot browse `mixamo.com`'s live animation catalog (it requires an Adobe login and is a JS SPA backed by an authenticated API — direct API calls returned `403 Forbidden`). No third-party mirror, gist, or dataset I found lists Mixamo's human-readable catalog of "happy" locomotion clips by exact name; the public GitHub/Hugging Face Mixamo mirrors (e.g. `jasongzy/Mixamo` on Hugging Face, used for the "Make-It-Animatable" retargeting research, and Aberman et al.'s "Skeleton-Aware Networks" dataset) ship bone/motion data without a searchable name index, and community "download-all" scripts don't publish a catalog either.

What I can respond with is: **you (or a teammate) need to log into mixamo.com and search these terms directly** — Mixamo's search is a simple keyword match over clip titles, so try each of:
- `skip` — likely candidate for a literal skipping locomotion cycle
- `hop`
- `jump` (then filter by eye for a bouncy/joyful one vs. a combat/parkour jump — Mixamo's catalog skews heavily toward combat, dance, and zombie/horror content based on what I could see of its content distribution)
- `cheer`, `excited`, `jubilant`, `celebrate`, `happy` — for a stationary joy reaction to crossfade into at the end of a skip
- `silly dance`, `hip hop dancing` — confirmed to exist by multiple tutorials/forum posts, useful as a fun idle/celebration clip even if not literally a skip

Each Mixamo clip preview plays a looping GIF/video in the picker before download, so the fastest verification is visual: search each term, eyeball the preview, and download the one that reads as "cartoon girl happy skip." Do this before committing to specific file/clip names in code.

## 2. Getting the mesh onto a Mixamo (or Mixamo-compatible) skeleton

Two round-trip options, both real and in active use per current tutorials/blogs:

**A. Meshy → Mixamo round trip (recommended for this project)**
1. Generate/export the character from Meshy as FBX or OBJ, in a clean T-pose or A-pose, centered at the origin, facing forward, feet at ground level (Meshy's own auto-rig tutorial gives this same prep checklist).
2. Go to mixamo.com → "Upload Character," drag in the FBX/OBJ.
3. Mixamo's auto-rigger asks you to place a handful of markers (chin, wrists, elbows, knees, groin) on the T-pose mesh, then computes a full Mixamo skeleton automatically.
4. Now browse and apply any Mixamo animation directly to your own character in the preview pane, and download as **FBX for Unity/Unreal → "with skin"** for the first download (to get the skinned mesh once) and **"without skin"** for every subsequent animation clip (smaller files, same skeleton).
   Source: Curtision's "From AI to Animation: Meshy → Mixamo → Unreal Engine 5" walkthrough confirms this exact Meshy-export → Mixamo-upload → marker-placement → download-with-skin sequence.

**B. Meshy's own auto-rigger (skip Mixamo entirely)**
Meshy ships its own auto-rig feature (humanoid/quadruped/custom skeleton types, bone editor, and a built-in animation library) and can export the rigged, animated result directly as FBX/GLB/USDZ. This is faster if you don't need Mixamo's specific clip library, but Meshy's own animation library is smaller and I found no evidence it interoperates with Mixamo's clip catalog — it's a separate skeleton convention. **If you want Mixamo's specific skip animations, route A is the one to use.**

## 3. Retargeting a Mixamo clip onto a non-Mixamo skeleton

Only needed if your character's skeleton is *not* itself a Mixamo rig (e.g., a hand-modeled rig, a Meshy-only auto-rig kept as-is, or a different mocap skeleton convention).

### Runtime: `three/examples/jsm/utils/SkeletonUtils.js`
Verified against the official three.js docs page (`threejs.org/docs/pages/module-SkeletonUtils.html`):

```js
import { retarget, retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'

// retarget(target, source, options) — copies a single pose
// retargetClip(target, source, clip, options) — returns a retargeted AnimationClip
const retargetedClip = retargetClip(targetModel, mixamoSourceObject, mixamoClip, {
  useFirstFramePosition: false,
  hip: 'mixamorigHips',        // name of the source's hip bone
  names: { /* targetBoneName: sourceBoneName, ... */ },
  scale: 1,
})
```

`RetargetOptions` fields (from the docs): `useFirstFramePosition`, `fps`, `names` (target→source bone-name map), `getBoneName` (function alternative to `names`), `trim: [start, end]`, `preserveBoneMatrix`, `preserveBonePositions`, `useTargetMatrix`, `hip`, `hipInfluence` (Vector3), `scale`, `localOffsets` (per-bone Matrix4 map), `hipPosition`.

**Gotchas (verified via three.js forum threads and a GitHub issue, not just the docs):**
- These functions are widely reported as broken/unreliable for GLTF-sourced skeletons. A forum thread (`discourse.threejs.org/t/skeletonutils-retarget-doesnt-work-with-mixamorig-skeleton-inverted-feet-backward-hands/54892`) shows `retarget()` producing inverted feet and backward hands even retargeting **between two identical Mixamo Y-Bot skeletons** — i.e., it's not just a "different rig" problem, it's a bug in the current implementation.
- A second thread (`discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149`) traces the root cause: the implementation was originally written for BVH-sourced skeletons (uniformly oriented bones) and doesn't correctly account for GLTF bind matrices, where rest-pose bone orientations vary per model. A community fix (accounting for bind matrices, converting to global space before extracting offsets) was proposed but the thread does not confirm it was merged into three.js core — **treat current `SkeletonUtils.retarget`/`retargetClip` as unreliable for GLTF↔GLTF or GLTF↔Mixamo-FBX retargeting until you've tested your specific rig pair.**
- GitHub issue `mrdoob/three.js#25751` corroborates parameter/behavior mismatches between the documented API and actual runtime errors.
- Practical implication: **budget time to test `retargetClip` on your actual character before depending on it**, and have the Blender fallback ready.

### Offline: Blender-based conversion (more reliable fallback)
Verified via multiple current sources:
- **Auto-Rig Pro's Remap tool** — paid Blender add-on; ships with built-in presets specifically for "traditional mocap skeletons, such as Mixamo, Rokoko, XSens," with an interactive bone-name mapper, IK hands/feet support, and a proportion-offset tool for retargeting onto differently-proportioned characters. This is the most production-proven route (`lucky3d.fr/auto-rig-pro/doc/remap_doc.html`).
- **Rokoko's Blender retargeting plugin** — free/freemium, manual bone-to-bone mapping between the mocap skeleton and your rig (`rokoko.com` retargeting guide).
- **Free/community add-ons**: `Mixamo Rig` (Blender Extensions marketplace) and the `Expy-Kit` add-on (specifically for Mixamo → Rigify) were both surfaced in current search results as free alternatives if you don't want Auto-Rig Pro's license cost.
- Workflow: import the Mixamo FBX animation(s) and your character's rig into the same Blender scene → map bones once → bake the retargeted action onto your rig → export a single GLB with all baked clips as separate `AnimationClip` entries → load that one GLB in R3F. This avoids any runtime retargeting risk entirely and is the safer choice if the SkeletonUtils gotchas above bite you.

## 4. Crossfading clips in `@react-three/drei`'s `useAnimations` (skip → idle → discovery-jump → wave)

Verified against the **official three.js example** `examples/webgl_animation_skinning_blending.html` (`github.com/mrdoob/three.js/blob/master/examples/webgl_animation_skinning_blending.html`), which is the canonical crossfade reference implementation. Its core pattern, translated to R3F:

```jsx
import { useGLTF, useAnimations } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'

function Character() {
  const group = useRef()
  const { scene, animations } = useGLTF('/character.glb')
  const { actions, mixer } = useAnimations(animations, group)
  const [current, setCurrent] = useState('skip')

  useEffect(() => {
    const next = actions[current]
    next.reset().fadeIn(0.4).play()
    return () => next.fadeOut(0.4) // cleanup when `current` changes
  }, [current, actions])

  return <primitive ref={group} object={scene} />
}
```

The three.js example's lower-level equivalent (verified, exact functions from the source):

```js
function setWeight(action, weight) {
  action.enabled = true
  action.setEffectiveTimeScale(1)
  action.setEffectiveWeight(weight)
}

function executeCrossFade(startAction, endAction, duration) {
  setWeight(endAction, 1)
  endAction.time = 0
  startAction.crossFadeTo(endAction, duration, true)
}

// for a clip that should only cut over at its own loop boundary (e.g. skip → idle)
function synchronizeCrossFade(startAction, endAction, duration) {
  mixer.addEventListener('loop', function onLoopFinished(event) {
    if (event.action === startAction) {
      mixer.removeEventListener('loop', onLoopFinished)
      executeCrossFade(startAction, endAction, duration)
    }
  })
}
```

For your `skip → idle → discovery-jump → wave` sequence: use plain `fadeIn`/`fadeOut` (or `crossFadeTo`) for transitions that can happen at any time (e.g., interrupting skip to react to a discovery), and `synchronizeCrossFade`-style loop-boundary waiting only where a hard cut would look bad mid-stride (e.g., letting the skip finish its current foot-cycle before transitioning to idle). Make non-looping clips (`discovery-jump`, `wave`) use `LoopOnce` and `clampWhenFinished = true`, and listen for `mixer`'s `finished` event to auto-crossfade back to `idle`/`skip`.

## 5. Root-motion removal (animate in place)

Verified via multiple current sources, though there's no single canonical three.js API for stripping root motion post-load — the reliable approaches are:

- **At the source (preferred)**: Mixamo's own animation preview panel has an **"In Place"** checkbox for clips that have translational root motion; enabling it before download bakes a version of the clip with hip-translation zeroed, so you never touch it in three.js. This is confirmed by the Adobe community thread on Mixamo "in place" behavior and is the standard advice repeated across tutorials.
- **Community tooling**: `sebastianoboem/Mixamo-Root-Motion-Remover` (GitHub) is a small standalone tool specifically for stripping root motion from Mixamo FBX exports when "In Place" wasn't available/selected for a given clip, for engines/pipelines downstream of Mixamo.
- **Programmatic (three.js-side) fallback**: if you're stuck with a clip that has root motion baked in and can't re-download, you can strip the hip bone's positional `VectorKeyframeTrack` from the `AnimationClip.tracks` array before creating the `AnimationAction` (zero out X/Z, or all of X/Y/Z, keep Y if you want vertical bounce from the skip/hop to remain and only strip horizontal drift) — I did not find an official three.js utility for this; it's a manual `clip.tracks.filter/map` operation on tracks whose name matches the hip/root bone.

## 6. Driving `mixer.timeScale` from scroll velocity

No single canonical "scroll → animation speed" three.js example was found, but the constituent, verified pieces are standard drei/R3F patterns:

- `@react-three/drei`'s `ScrollControls` + `useScroll()` gives a `scroll.offset` (0–1 scroll progress) and internally tracks a `delta`/velocity signal usable inside `useFrame`.
- Compute a scroll-velocity estimate yourself if you need more control than `useScroll` exposes directly: keep a ref to last scroll offset, diff it against the current offset each `useFrame` tick, divide by `frameDelta` to get a velocity, then smooth it (simple lerp/exponential moving average) to avoid jitter driving the mixer unevenly.
- Apply it directly to the mixer (affects every action) or to a specific action (affects only that clip) — both are plain three.js API, confirmed by `AnimationMixer`/`AnimationAction` docs:
  ```js
  useFrame((_, delta) => {
    const targetTimeScale = THREE.MathUtils.clamp(0.2 + scrollVelocity * k, 0.2, 2.0)
    mixer.timeScale = THREE.MathUtils.damp(mixer.timeScale, targetTimeScale, 4, delta)
  })
  ```
- The official `webgl_animation_skinning_blending` example itself exposes a `modify time scale` GUI slider bound straight to `mixer.timeScale` in the range `0.0–1.5`, confirming `mixer.timeScale` as the correct, supported lever for global speed control (per-action `setEffectiveTimeScale`/`action.timeScale` if you want skip speed to scale but wave/idle to stay constant).

---

## Sources

- [SkeletonUtils — three.js Docs](https://threejs.org/docs/pages/module-SkeletonUtils.html) — `retarget`/`retargetClip` signatures and `RetargetOptions` fields (verified, official).
- [three.js `webgl_animation_skinning_blending.html` example source](https://github.com/mrdoob/three.js/blob/master/examples/webgl_animation_skinning_blending.html) — canonical crossfade pattern (`setWeight`, `executeCrossFade`, `synchronizeCrossFade`, `mixer.timeScale` GUI slider) (verified, official).
- [SkeletonUtils.retarget() doesn't work with mixamoRig skeleton (inverted feet, backward hands) — three.js forum](https://discourse.threejs.org/t/skeletonutils-retarget-doesnt-work-with-mixamorig-skeleton-inverted-feet-backward-hands/54892) — reproduces the retarget bug even between identical Mixamo skeletons.
- [Fixing SkeletonUtils retarget() and retargetClip() functions — three.js forum](https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149) — root cause (BVH-oriented design vs. GLTF bind matrices) and proposed fix, unclear merge status.
- [SkeletonUtils `.retarget()` and `.retargetClip()` error with documented `SkeletonHelper` params — GitHub issue #25751](https://github.com/mrdoob/three.js/issues/25751) — corroborates API/behavior mismatch.
- [Remap — Auto-Rig Pro Doc](https://www.lucky3d.fr/auto-rig-pro/doc/remap_doc.html) — Blender-based retargeting with Mixamo presets (verified, official add-on docs).
- [Ace Retargeting in Blender with this Simple Workflow — Rokoko](https://www.rokoko.com/insights/ace-retargeting-in-blender-with-this-simple-workflow-i-the-ultimate-retargeting-guide) — Rokoko's Blender retargeting workflow.
- [Mixamo Rig — Blender Extensions](https://extensions.blender.org/add-ons/mixamo-rig/) and [Blender Expy-Kit addon: Easy Mixamo to Rigify retargeting — BlenderNation](https://www.blendernation.com/2022/06/04/blender-expy-kit-addon-easy-mixamo-to-rigify-retargeting/) — free Blender-side Mixamo conversion add-ons.
- [🌀 From AI to Animation: Building a Fully Rigged 3D Character with Meshy, Mixamo, and Unreal Engine 5 — Curtision](https://curtision.com/2025/05/26/from-ai-to-animation/) — concrete Meshy-export → Mixamo-upload → marker-placement → download pipeline (verified against fetched page content).
- [How to AI Auto-Rig a 3D Character: A Complete Guide — Meshy](https://www.meshy.ai/tutorials/character-auto-rigging-workflow) — Meshy's own auto-rig steps; confirms Meshy does not itself integrate with Mixamo (verified against fetched page content).
- [AI Auto-Rigging Showdown 2026: Tripo, Meshy, Cascadeur, AccuRig, and Mixamo Tested in UE5 and Blender — StraySpark](https://www.strayspark.studio/blog/ai-auto-rigging-showdown-2026-tripo-meshy-cascadeur-mixamo) — comparative context on auto-rigger options (not deeply fetched; title/summary only).
- [Fix missing "in place" for animations that moves — Adobe Community](https://community.adobe.com/t5/mixamo-discussions/fix-missing-quot-in-place-quot-for-animations-that-moves/td-p/13598055) — confirms Mixamo's "In Place" root-motion option and its limitations.
- [GitHub - sebastianoboem/Mixamo-Root-Motion-Remover](https://github.com/sebastianoboem/Mixamo-Root-Motion-Remover) — standalone root-motion stripping tool for Mixamo FBX exports.
- [AnimationMixer – three.js docs](https://threejs.org/docs/pages/AnimationMixer.html) — confirms `mixer.timeScale` as the documented global-speed lever (verified, official).
- [jasongzy/Mixamo — Hugging Face dataset](https://huggingface.co/datasets/jasongzy/Mixamo) — public Mixamo motion/character dataset (2453 motions, 95 T-pose characters) used for the "Make-It-Animatable" research; confirms scale of Mixamo's catalog but not a browsable name index.
- **Not found / unverifiable**: an authoritative, human-readable catalog of exact Mixamo clip names for "skip"/"hop"/"joy" — Mixamo's catalog sits behind an authenticated SPA (direct API calls returned `403`), and no third-party mirror indexes clip titles. Action item: search `mixamo.com` directly for `skip`, `hop`, `jump`, `cheer`, `excited`, `jubilant`, `celebrate` and pick by the preview GIF.
