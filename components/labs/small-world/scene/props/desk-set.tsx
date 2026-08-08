'use client'
import { DeskGlb } from './desk-glb'
import { DeskDeepInteractions } from './desk-deep-interactions'
import { DeskInteractions } from './desk-interactions'
import { DeskNote } from './desk-note'
import { DeskSteam } from './desk-steam'
import type { JourneyRef } from '../use-journey'

/**
 * THE DESK (Task 65, re-made in Task 68) — the surface the little world turns out to be sitting on,
 * and now Alwina's desk rather than a generic one.
 *
 * A SIBLING of the planet, never a child: the planet is a wheel that has spun four times by the
 * time anyone sees this, and a desk parented to it would have spun with it. It is also completely
 * static — no gate, no fade, not one number read per frame that has not changed. It is mounted from
 * the first paint of the lab and the journey camera simply cannot see it (`desk-stage.ts` carries
 * the proof and `desk-stage.test.ts` re-derives it from the real frustum corner rays at every
 * aspect; `desk-glb.test.ts` re-checks it against the vertices the shipped asset actually contains).
 *
 * ============================================================================
 * WHAT TASK 68 CHANGED, AND WHAT IT DELIBERATELY DID NOT
 * ============================================================================
 * The ending is now a CONTRAST: the clay world against a fully lit studio. So everything that is
 * part of the ROOM — the slab, the pad, the mug, the books, the plant, the pen cup, the trinket
 * dish, the plasticine box and its bars — is baked in Blender from the approved candidate-B render
 * and arrives as one asset (`desk-glb.tsx`). Thirteen procedural clay props, a hand-formed slab and
 * the whole `desk-kit.ts` vocabulary retired with it.
 *
 * What did NOT change is the rule the round was given: CLAY IS THE MADE THINGS. The planet is
 * untouched, and the NOTE keeps its canvas-texture handwriting, because it is hers and a baked
 * photograph of a letter is not a letter.
 *
 * ============================================================================
 * ...AND THE HALF OF THAT RULE TASK 81 OVERTURNED
 * ============================================================================
 * This block used to carry a second survivor and an argument for it:
 *
 *   > the FIGURINES keep their toon shading and their ink contours, because they are souvenirs of
 *   > the journey and the whole point of the ending is that they do not match the room.
 *
 * It was a real argument and it is now REVERSED, by the only authority that could reverse it.
 * Aram asked twice for the bird and penguin he had approved in Blender — "we had other penguin and
 * bird figurines, now again I see the threejs generated ones" — and Task 79 found why he kept
 * seeing the wrong ones: the approved models had NEVER been exported. They sat in the blend so
 * their shadows would fall on the pad, excluded from the export set by name
 * (`t68_prep.py`, `t71_export.py`), and the exclusion outlived the approval it was contradicting.
 * Measured against the approved render, every other object on this desk registered at NCC 0.73–0.84
 * and the figurines at 0.131 — not a degraded version of the same asset, a different asset.
 *
 * So they are baked props now, exported through the same pipeline as everything else
 * (`t81_prep.py`) and joined into `DeskBaked`. Three consequences worth stating:
 *
 *  - THE COST IS NEGATIVE. Two draw calls go away — the merged clay mesh and its ink contour — and
 *    the ~10,000 vertices they become cost none, because they join a mesh that was already drawn.
 *  - THE TONE-MAPPING SPLIT CLOSES WHERE IT SHOWED. The clay path runs through r3f's default ACES
 *    while every baked material opts out with `toneMapped: false`, so the old figurines were the
 *    one place two view transforms met in one frame. The journey's clay still runs through ACES,
 *    deliberately and untouched; it is only these two that changed sides.
 *  - THE PRICE, STATED: the souvenirs no longer resemble the checkpoint mascots they are souvenirs
 *    of. That was the old law's real point, and it is what was traded away.
 *
 * Their contact shadows still live in the bake — the pad is baked with them standing on it, so the
 * pink under them is already dark in the texture. What changed is that it is now baked with the
 * figurines THEMSELVES rather than with 85% stand-ins for them. That is also why
 * `deskNoteShadowPart` is gone: it would be a second shadow painted on top of a real one.
 *
 * DRAW CALLS: five, down from seven. Four from the asset (the surface, every matte prop, the metal,
 * the donut glaze) and the note, which has its own material because it carries a texture — plus the
 * steam's one while the studio is up, and none before. Per frame: one float compare in
 * `desk-glb.tsx`, and nothing at all anywhere else — no component here allocates after mount.
 */

/**
 * `journeyRef` reaches two children for two different reasons: the NOTE reads it at one instant, to
 * decide whether a late webfont may still be swapped in unseen, and the ASSET reads `ending.zoom`
 * to drive the studio lights coming up. Nothing else in the set reads it.
 */
export function DeskSet({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <group>
      <DeskGlb journeyRef={journeyRef} />
      <DeskNote journeyRef={journeyRef} />
      {/* The two souvenirs are inside <DeskGlb> now — see the header for the law that changed.
          Their placement is published as DESK_FIGURINES in `desk-glb-contract.ts`, because the
          girl still has to stand between them without treading on either. */}
      {/* Wisps off the coffee (Task 72), hung on the GLB's `CoffeeAnchor` empty. One draw call while
          the studio is up and NONE at all before it — the plume is gated on `studioLightsFor`, so it
          is not drawn, not lit and not clocked anywhere in the journey. See `desk-steam.tsx` for the
          ENDING's first wall clock, and the scoping that costs it nothing. */}
      <DeskSteam journeyRef={journeyRef} />
      {/* The desk answers the pointer (Task 89): five props rock about their contact with the desk
          and the note's corner can be pressed flat, armed only once the studio is fully lit. Renders
          nothing — it drives uniforms in the materials above. `desk-nudge.ts` carries the law this
          feature creates (pointer-driven micro-animations, deterministic, always decaying to rest). */}
      <DeskInteractions journeyRef={journeyRef} />
      {/* The desk's deep tier (Task 92): set-piece interactions — the coffee stirs into a vortex
          under a click. Mounted AFTER the micro tier deliberately: the stir's mug nudge is posted
          this frame and stamped by the micro loop next frame, a fixed, deterministic order.
          `desk-deep.ts` carries the closed forms; renders nothing, costs rest frames nothing. */}
      <DeskDeepInteractions journeyRef={journeyRef} />
    </group>
  )
}
