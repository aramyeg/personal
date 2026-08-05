'use client'
import { DeskFigurines } from './desk-figurines'
import { DeskGlb } from './desk-glb'
import { DeskNote } from './desk-note'
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
 * untouched, and the two survivors on this desk stay exactly as they were —
 *
 *  - the NOTE keeps its canvas-texture handwriting, because it is hers and a baked photograph of a
 *    letter is not a letter;
 *  - the FIGURINES keep their toon shading and their ink contours, because they are souvenirs of
 *    the journey and the whole point of the ending is that they do not match the room.
 *
 * Their contact shadows moved into the bake rather than being drawn: the pad was baked in Blender
 * with stand-ins for the note and both figurines standing on it, so the pink under them is already
 * dark in the texture. That is why `deskNoteShadowPart` is gone — it would now be a second shadow
 * painted on top of a real one.
 *
 * DRAW CALLS: six. Three from the asset (the surface, every matte prop, the metal), the note (its
 * own material, because it carries a texture) and the two figurines (one merged clay mesh plus one
 * merged ink contour for the pair). Per frame: one float compare in `desk-glb.tsx`, and nothing at
 * all anywhere else — no component here allocates after mount.
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
      {/* Two souvenirs of the journey, at desk-toy scale (Task 66). Still clay, still toon-shaded —
          see the header for why they were not baked with the rest. */}
      <DeskFigurines />
    </group>
  )
}
