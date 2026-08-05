import { describe, expect, it } from 'vitest'
import { noteRepaintAllowed } from '@/components/labs/small-world/scene/props/desk-note'
import {
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  CAMERA_POSITION,
  cameraPositionAt,
} from '@/components/labs/small-world/scene/camera'

/**
 * THE NOTE (Task 65), and the one gate that outlived Task 68's bake.
 *
 * These two tests lived in `desk-kit.test.ts` beside measurements of thirteen procedural props, a
 * hand-formed slab and a merged clay set — all of which retired when the desk became a baked asset.
 * What they prove has nothing to do with any of that: the note is still the lab's own geometry,
 * still painted into a canvas, and still allowed to repaint itself only while the camera cannot see
 * it. So they move here rather than dying with the file that happened to hold them.
 */

/**
 * THE NOTE'S DEFERRED REPAINT (fix round, review finding 1).
 *
 * A late webfont upgrades the note's texture, and that upgrade must never be visible. The gate is
 * `ending.zoom === 0`, and its safety is not a margin — it is two proofs meeting exactly:
 *
 *   at zoom 0  ->  the camera pose is bit-identical to the static pose   (ending-camera.test.ts)
 *   static pose ->  every vertex of the sheet is out of frame            (desk-stage.test.ts)
 *
 * This holds the join. If a future edit let the gate open one frame into the pull-back, the second
 * implication stops applying and this fails.
 */
describe("the note's late-font upgrade can only happen off camera", () => {
  it('opens exactly where the camera is still at its static pose, and nowhere else', () => {
    for (let i = 0; i <= 4000; i++) {
      const progress = (i / 4000) * TRACK_END
      const ending = endingStateAt(progress)
      if (noteRepaintAllowed(ending)) {
        // the pose the containment proof is about — bit-identity, not closeness
        const pose = cameraPositionAt(progress)
        expect(Object.is(pose[0], CAMERA_POSITION[0])).toBe(true)
        expect(Object.is(pose[1], CAMERA_POSITION[1])).toBe(true)
        expect(Object.is(pose[2], CAMERA_POSITION[2])).toBe(true)
      } else {
        expect(ending.zoom).toBeGreaterThan(0)
      }
    }
  })

  it('is open for the whole journey and the whole still beat, and shut after', () => {
    expect(noteRepaintAllowed(endingStateAt(0))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(1))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(ZOOM_FIRST_MOVE))).toBe(true)
    expect(noteRepaintAllowed(endingStateAt(ZOOM_FIRST_MOVE + 1e-6))).toBe(false)
    expect(noteRepaintAllowed(endingStateAt(TRACK_END))).toBe(false)
  })
})
