import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  CURTAIN_BOW_FROM,
  CURTAIN_BOW_HOLD,
  CURTAIN_BOW_SPAN,
  CURTAIN_BOW_STAGGER,
  CURTAIN_CAST,
  CURTAIN_CROWN,
  CURTAIN_FOOT_Y,
  CURTAIN_GATHER_DONE,
  CURTAIN_OVERSHOOT,
  CURTAIN_PACK,
  CURTAIN_MAX_SWAY,
  CURTAIN_ROWS,
  CURTAIN_SET_BACK,
  CURTAIN_SIZE_GOOD,
  CURTAIN_SIZE_MAX,
  CURTAIN_V_FLOOR,
  CURTAIN_WORLD_MARGIN,
  ENDING_BOT,
  ENDING_TOP,
  ENDING_U0,
  ENDING_U1,
  curtainArrival,
  curtainBlocked,
  curtainBow,
  curtainCompositionBox,
  curtainFaceBox,
  curtainFigureBox,
  curtainHalfHeight,
  curtainIdle,
  curtainLayout,
  curtainNearestDepth,
  curtainPhase,
  curtainRowDistance,
  curtainRowOffset,
  curtainRowScale,
  curtainStageQuaternion,
  curtainTransitDepth,
  curtainWorldReach,
  type CurtainSlot,
} from '@/components/labs/small-world/scene/props/curtain-stage'
import {
  DRIFT_ROLL,
  MASCOT_BOX,
  PEEKER_CAST,
  WORLD_BOT,
  WORLD_TOP,
  type Side,
} from '@/components/labs/small-world/scene/props/peeker-stage'
import { PEEKER_SPECS } from '@/components/labs/small-world/scene/props/peeker-cast'
import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_TARGET,
  cameraPositionAt,
} from '@/components/labs/small-world/scene/camera'
import {
  CURTAIN_END,
  ENDING_SPAN,
  TRACK_END,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'

/**
 * Task 64 — the curtain call's staging.
 *
 * The promise being gated is specific: the whole cast bows around the world without covering it or
 * the girl, at a size a reader can name the animals at, on every frame the lab ships to — and the
 * whole beat recedes with the world rather than in front of it. Every check below is against a
 * MEASURED input (the ending face's silhouette, the cast's own envelopes) or against the shipped
 * camera path, never against a number restated here.
 */

const PLANET_RADIUS = 2.2
/** The bake's terrain+prop ceiling budget: 1.35 x the planet's radius. */
const CEILING = 2.97

const FRAMES: [string, number, number][] = [
  ['wide 1920x1080', 1920, 1080],
  ['desktop 1440x900', 1440, 900],
  ['laptop 1600x900', 1600, 900],
  ['small 1024x768', 1024, 768],
  ['tablet 768x1024', 768, 1024],
  ['phone 390x844', 390, 844],
]

const layouts = FRAMES.map(([name, w, h]) => [name, w, h, curtainLayout(w / h)] as const)

/** A swept envelope placed at a slot and scaled, in half-heights. */
function rect(box: { x0: number; y0: number; x1: number; y1: number }, s: CurtainSlot, k = 1) {
  return {
    x0: s.u * k + box.x0 * s.size,
    x1: s.u * k + box.x1 * s.size,
    y0: s.v * k + box.y0 * s.size,
    y1: s.v * k + box.y1 * s.size,
  }
}
const faceOf = (s: CurtainSlot, k = 1) => rect(curtainFaceBox(s.side), s, k)
const figureOf = (s: CurtainSlot, k = 1) => rect(curtainFigureBox(s.side), s, k)

describe('the stage frame', () => {
  /**
   * The whole design rests on this: the ending's camera TRANSLATES along its ray and always aims at
   * the same target, so its orientation never changes and a static group can carry it. If T65's
   * re-aim ever breaks that, this fails — which is the intended alarm, and is why it is checked
   * against `cameraPositionAt` rather than against a pitch written down twice.
   */
  it('carries the camera orientation, and that orientation is constant for the whole ending', () => {
    const rest = curtainStageQuaternion()
    for (let i = 0; i <= 20; i++) {
      const progress = 1 + (i / 20) * ENDING_SPAN
      const eye = cameraPositionAt(progress)
      // what the scene's own rig produces at this stop
      // A PerspectiveCamera, not an Object3D: `Object3D.lookAt` swaps eye and target for
      // anything that is not a camera or a light, so the plain-object version of this check is
      // 180 degrees wrong and proves nothing. The scene aims a PerspectiveCamera; so does this.
      const cam = new THREE.PerspectiveCamera(CAMERA_FOV)
      cam.position.fromArray(eye)
      cam.lookAt(CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2])
      cam.updateMatrixWorld()
      // 1e-6 rad, not 0: the eye is re-normalised from a position that grows by 3x across
      // the pull-back, so the basis carries float noise of that order. It is six orders
      // below the 0.35 rad the frame would be wrong by if the orientation actually moved.
      expect(Math.abs(rest.angleTo(cam.quaternion))).toBeLessThan(1e-6)
    }
  })

  /**
   * "The planet is never covered" is a GEOMETRY claim here rather than a placement one, and this is
   * the arithmetic behind it: at its parked slot no fragment of any composition comes within the
   * bake's whole ceiling budget of the planet's centre, so nothing the cast does can put clay in
   * front of the world.
   *
   * Note what is deliberately NOT asserted: the same clearance during the GATHER. Early in the
   * entrance a composition sits near the ring's axis and its far corner does reach inside that
   * radius — behind the planet, inside its own silhouette, which is the entrance working exactly
   * as designed. Asserting it there would be asserting against the hiding place.
   */
  it('never comes within the planet ceiling budget at its parked slot', () => {
    expect(CURTAIN_SET_BACK).toBeGreaterThan(CEILING)
    for (const [name, , , slots] of layouts) {
      for (const slot of slots) {
        const halfH = curtainHalfHeight(CAMERA_FOV, curtainRowDistance(slot.row))
        const world = slot.size * curtainRowScale(slot.row) * halfH
        const box = curtainCompositionBox(slot.side)
        let nearest = Infinity
        for (const bx of [box.x0, box.x1]) {
          for (const by of [box.y0, box.y1]) {
            for (const bz of [-1.3, box.z]) {
              nearest = Math.min(
                nearest,
                Math.hypot(
                  slot.u * halfH + bx * world,
                  slot.v * halfH + by * world,
                  -curtainRowOffset(slot.row) + bz * world
                )
              )
            }
          }
        }
        expect(nearest, `${name} at u=${slot.u.toFixed(2)}`).toBeGreaterThan(CEILING)
      }
    }
    expect(curtainNearestDepth(CURTAIN_SIZE_MAX, curtainHalfHeight(CAMERA_FOV))).toBeGreaterThan(
      CAMERA_DISTANCE
    )
  })

  it('sweeps at least as deep an envelope for the transit as for the parked pose', () => {
    // The transit poses are a SUPERSET of the settled ones, so this can never come out smaller. It
    // guards against the sweep quietly ceasing to cover the entrance — it is not a claim that the
    // tucked lean is the deepest pose, which it is not: the bow's forward fold reaches further
    // toward the camera than any lean does.
    for (const side of [-1, 1] as Side[]) {
      expect(curtainTransitDepth(side)).toBeGreaterThanOrEqual(curtainCompositionBox(side).z)
    }
  })
})

describe('the ending face', () => {
  it('sits inside the six-chapter silhouette the checkpoints stage against', () => {
    expect(ENDING_TOP).toHaveLength(WORLD_TOP.length)
    expect(ENDING_BOT).toHaveLength(WORLD_BOT.length)
    for (let i = 0; i < ENDING_TOP.length; i++) {
      if (ENDING_TOP[i] === 0 && ENDING_BOT[i] === 0) continue
      // ...to within the margin the layout already carries. The two benches sample the girl's
      // ambient animation at different phases (chapter 6 mid-dwell against the parked ending), so a
      // few thousandths of disagreement at her own two columns is the measurement, not a world that
      // grew past the six-chapter envelope.
      expect(ENDING_TOP[i]).toBeLessThanOrEqual(WORLD_TOP[i] + CURTAIN_WORLD_MARGIN)
      expect(ENDING_BOT[i]).toBeGreaterThanOrEqual(WORLD_BOT[i] - CURTAIN_WORLD_MARGIN)
    }
  })

  it('contains the planet the camera actually sees, so the table cannot be optimistic', () => {
    // The bare sphere's on-screen radius, from the projection rather than from the table:
    // sin of the angular radius over the frustum's own half-angle.
    const ndc =
      Math.tan(Math.asin(PLANET_RADIUS / CAMERA_DISTANCE)) / Math.tan((CAMERA_FOV * Math.PI) / 360)
    expect(Math.max(...ENDING_TOP)).toBeGreaterThan(ndc)
    expect(Math.min(...ENDING_BOT)).toBeLessThan(-ndc * 0.9)
    // and the profile is blocked across the whole width the sphere spans
    for (const u of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const b = curtainBlocked(u, u)
      expect(b).not.toBeNull()
      expect(b!.top - b!.bot).toBeGreaterThan(ndc)
    }
  })

  it('reports no block outside the sampled span', () => {
    expect(curtainBlocked(ENDING_U0 - 0.2, ENDING_U0 - 0.15)).toBeNull()
    expect(curtainBlocked(ENDING_U1 + 0.15, ENDING_U1 + 0.2)).toBeNull()
  })
})

describe('the layout', () => {
  it('seats the whole company on every frame the lab ships to', () => {
    for (const [name, , , slots] of layouts) {
      expect(slots.length, name).toBe(CURTAIN_CAST.length)
    }
  })

  it('keeps every FACE clear of the world and wholly on frame', () => {
    for (const [name, w, h, slots] of layouts) {
      const halfW = w / h
      for (let i = 0; i < slots.length; i++) {
        const f = faceOf(slots[i])
        const blocked = curtainBlocked(f.x0, f.x1)
        const clear = !blocked || f.y0 >= blocked.top || f.y1 <= blocked.bot
        expect(clear, `${name} ${CURTAIN_CAST[i].kind} face vs world`).toBe(true)
        expect(f.x0, `${name} ${CURTAIN_CAST[i].kind}`).toBeGreaterThanOrEqual(-halfW)
        expect(f.x1, `${name} ${CURTAIN_CAST[i].kind}`).toBeLessThanOrEqual(halfW)
        expect(f.y0).toBeGreaterThanOrEqual(-1)
        expect(f.y1).toBeLessThanOrEqual(1)
      }
    }
  })

  /**
   * The clearance has to hold at the arrival's OVERSHOOT too — the T53 lesson, which is that a
   * clearance evaluated only at the parked pose is a clearance the figure leaves the moment it
   * moves. The overshoot is radial, so it is a pure scale on the slot.
   */
  it('holds the frame at the arrival overshoot, not only at the parked slot', () => {
    for (const [name, w, h, slots] of layouts) {
      const halfW = w / h
      for (const slot of slots) {
        const f = faceOf(slot, CURTAIN_OVERSHOOT)
        expect(f.x0, name).toBeGreaterThanOrEqual(-halfW)
        expect(f.x1, name).toBeLessThanOrEqual(halfW)
        expect(f.y0, name).toBeGreaterThanOrEqual(-1)
        expect(f.y1, name).toBeLessThanOrEqual(1)
      }
    }
    // ...and the overshoot is the easing's real peak, not a number picked to match it
    let peak = 0
    for (let i = 0; i <= 400; i++) peak = Math.max(peak, curtainArrival(i / 400, 0))
    expect(peak).toBeLessThanOrEqual(CURTAIN_OVERSHOOT + 1e-9)
    expect(peak).toBeGreaterThan(1.05)
  })

  it('never lets a figure into the girl’s crown', () => {
    for (const [name, w, h, slots] of layouts) {
      const crown = Math.min(CURTAIN_CROWN.u, 0.65 * (w / h))
      for (const slot of slots) {
        for (const k of [1, CURTAIN_OVERSHOOT]) {
          const b = figureOf(slot, k)
          const inside = b.x0 < crown && b.x1 > -crown && b.y1 > CURTAIN_CROWN.v
          expect(inside, `${name} slot at u=${slot.u.toFixed(2)}`).toBe(false)
        }
      }
    }
  })

  it('stays above the floor reserved for the desk', () => {
    for (const [name, , , slots] of layouts) {
      for (const slot of slots) {
        for (const k of [1, CURTAIN_OVERSHOOT]) {
          expect(figureOf(slot, k).y0, name).toBeGreaterThanOrEqual(CURTAIN_V_FLOOR)
        }
      }
    }
  })

  /**
   * On a frame that seats the company at full spacing, no two FIGURES may overlap — a crowd is a
   * composition, two mascots sharing a silhouette is a mistake. On a frame that had to crowd (a
   * phone in portrait, where the only clear sky is one band under the horizon) neighbours are
   * allowed to overlap, and the alternating stage rows are what make that legible: an overlapping
   * pair is then genuinely at two depths and occludes cleanly.
   */
  it('resolves every figure overlap in DEPTH, and leaves none inside one row', () => {
    for (const [name, , , slots] of layouts) {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = figureOf(slots[i])
          const b = figureOf(slots[j])
          if (!(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0)) continue
          // Two mascots sharing a silhouette at one depth is a mistake; at two depths it is a
          // crowd, and the depth buffer settles it rather than mount order.
          expect(
            slots[i].row,
            `${name} ${CURTAIN_CAST[i].kind}/${CURTAIN_CAST[j].kind} overlap inside one row`
          ).not.toBe(slots[j].row)
        }
      }
    }
  })

  it('reads the company around the ring in journey order, splitting the two wings', () => {
    for (const [name, , , slots] of layouts) {
      // The parameterisation runs counter-clockwise from the crown, so the angle is monotone.
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].angle, `${name} ${i}`).toBeGreaterThan(slots[i - 1].angle)
      }
    }
    // ...and on any frame with room on both flanks, the journey's first half is on the left.
    const desktop = layouts.find(([n]) => n.startsWith('desktop'))![3]
    expect(desktop.slice(0, 6).every((s) => s.side === -1)).toBe(true)
    expect(desktop.slice(6).every((s) => s.side === 1)).toBe(true)
  })

  /**
   * Not "bigger frame, bigger cast" — the search stops buying size with distance at
   * CURTAIN_SIZE_GOOD, so every landscape frame lands at roughly the same figure and spends the
   * rest on standing close to the world. What has to hold is that the frames with room REACH that
   * size, and that the ones without degrade rather than fail.
   */
  it('reaches the size worth showing wherever the frame has room for it', () => {
    const size = (n: string) => layouts.find(([x]) => x.startsWith(n))![3][0].size
    for (const frame of ['wide', 'desktop', 'laptop', 'small']) {
      expect(size(frame), frame).toBeGreaterThanOrEqual(CURTAIN_SIZE_GOOD)
    }
    // portrait cannot, and says so by coming out smaller rather than by seating nobody
    expect(size('phone')).toBeLessThan(CURTAIN_SIZE_GOOD)
    for (const [name, , , slots] of layouts) {
      expect(slots[0].size, name).toBeLessThanOrEqual(CURTAIN_SIZE_MAX)
    }
  })

  /**
   * The entrance's hiding place is the world itself: at `curtain` 0 every composition sits at the
   * centre of the ring, on a plane past the bake's ceiling, so the planet's own silhouette covers
   * it. Nothing gates visibility — if this stops being true the cast pops into existence.
   */
  it('hides the whole company behind the planet at curtain 0', () => {
    const ndc =
      Math.tan(Math.asin(PLANET_RADIUS / CAMERA_DISTANCE)) / Math.tan((CAMERA_FOV * Math.PI) / 360)
    for (const [name, , , slots] of layouts) {
      for (const slot of slots) {
        expect(Math.abs(curtainArrival(0, 0))).toBeLessThan(1e-12)
        const box = curtainCompositionBox(slot.side)
        const half = Math.max(-box.x0, box.x1, -box.y0, box.y1) * slot.size
        // the composition is centred on the ring's origin, so its whole extent is `half`
        expect(half, `${name} ${slot.size}`).toBeLessThan(ndc)
      }
    }
  })
})

describe('the choreography', () => {
  it('finishes the gather before the first figure bows', () => {
    expect(CURTAIN_BOW_FROM).toBeGreaterThan(CURTAIN_GATHER_DONE)
    for (let i = 0; i < CURTAIN_CAST.length; i++) {
      expect(curtainBow(CURTAIN_GATHER_DONE, i)).toBe(0)
      expect(curtainArrival(CURTAIN_GATHER_DONE, i)).toBeCloseTo(1, 6)
    }
  })

  it('lands the whole bow inside the curtain window', () => {
    const last = CURTAIN_CAST.length - 1
    expect(CURTAIN_BOW_FROM + last * CURTAIN_BOW_STAGGER + CURTAIN_BOW_SPAN).toBeLessThanOrEqual(1)
    for (let i = 0; i < CURTAIN_CAST.length; i++) {
      expect(curtainBow(1, i)).toBeCloseTo(CURTAIN_BOW_HOLD, 6)
    }
  })

  it('staggers the gather so the company is never in lockstep', () => {
    // At the moment the first figure has fully arrived, the last has not started to settle.
    const first = curtainArrival(0.3, 0)
    const last = curtainArrival(0.3, CURTAIN_CAST.length - 1)
    expect(first).toBeCloseTo(1, 6)
    expect(last).toBeLessThan(0.9)
  })

  it('dips to a full bow and then HOLDS a fraction of it — the bow does not pack up', () => {
    const samples: number[] = []
    for (let i = 0; i <= 400; i++) samples.push(curtainBow(i / 400, 0))
    expect(Math.max(...samples)).toBeCloseTo(1, 3)
    // parked, for the still beat and the whole pull-back
    expect(curtainBow(1, 0)).toBeCloseTo(CURTAIN_BOW_HOLD, 6)
    expect(CURTAIN_BOW_HOLD).toBeGreaterThan(0)
    expect(CURTAIN_BOW_HOLD).toBeLessThan(1)
  })

  /**
   * The idle rides the ending's own `t`, not `curtain` — `curtain` parks at 1 at CURTAIN_END and
   * stays there for the still beat and the entire pull-back, so an idle keyed to it would leave a
   * frozen company to be pulled away from. Checked as an EFFECT: the gesture has to differ between
   * two stops that share a `curtain` of exactly 1.
   */
  it('keeps the company alive through the still beat and the pull-back', () => {
    const a = endingStateAt(1 + CURTAIN_END * ENDING_SPAN)
    const b = endingStateAt(1 + ZOOM_START * ENDING_SPAN)
    const c = endingStateAt(TRACK_END)
    expect(a.curtain).toBe(1)
    expect(b.curtain).toBe(1)
    expect(c.curtain).toBe(1)
    const spec = PEEKER_SPECS[CURTAIN_CAST[0].kind]
    const at = (t: number) => curtainIdle(t, spec.cycles, curtainPhase(0))
    expect(Math.abs(at(a.t) - at(b.t))).toBeGreaterThan(0.05)
    expect(Math.abs(at(b.t) - at(c.t))).toBeGreaterThan(0.05)
  })

  /**
   * Forward equals backward BY CONSTRUCTION, and this is the effect check for it: walk the whole
   * ending's scroll domain in both directions and require the produced pose to be bit-identical.
   * A wall clock anywhere in the chain — the one thing the ending contract forbids — makes this
   * fail without needing to name what was called.
   */
  it('scrubs backwards to the same pose, bit for bit', () => {
    const pose = (progress: number) => {
      const e = endingStateAt(progress)
      const out: number[] = []
      for (let i = 0; i < CURTAIN_CAST.length; i++) {
        const spec = PEEKER_SPECS[CURTAIN_CAST[i].kind]
        out.push(
          curtainArrival(e.curtain, i),
          curtainBow(e.curtain, i),
          curtainIdle(e.t, spec.cycles, curtainPhase(i))
        )
      }
      return out
    }
    const stops: number[] = []
    for (let i = 0; i <= 120; i++) stops.push(1 + (i / 120) * ENDING_SPAN)
    const forward = stops.map(pose)
    const backward = [...stops].reverse().map(pose).reverse()
    expect(backward).toEqual(forward)
  })

  it('gives every member its own idle phase', () => {
    const seen = new Set(CURTAIN_CAST.map((_, i) => curtainPhase(i).toFixed(4)))
    expect(seen.size).toBe(CURTAIN_CAST.length)
  })
})

describe('the company', () => {
  it('is the checkpoint cast, in journey order, with nothing added or dropped', () => {
    expect(CURTAIN_CAST).toHaveLength(PEEKER_CAST.length * 2)
    for (let c = 0; c < PEEKER_CAST.length; c++) {
      expect(CURTAIN_CAST[c * 2]).toEqual({ biome: PEEKER_CAST[c].biome, kind: PEEKER_CAST[c].left })
      expect(CURTAIN_CAST[c * 2 + 1]).toEqual({
        biome: PEEKER_CAST[c].biome,
        kind: PEEKER_CAST[c].right,
      })
    }
    expect(new Set(CURTAIN_CAST.map((m) => m.kind)).size).toBe(CURTAIN_CAST.length)
  })

  it('sweeps an envelope that covers every sway the shipped specs ask for', () => {
    // PER KIND, because the two terms do not belong to the same animal: only the drifting
    // composition adds its raft's roll, and its passenger's own sway was lowered when it gained the
    // floe precisely so the total would not grow. Taking the cast's largest sway and adding the
    // drift to it invents a figure that is not in the cast.
    const worst = Math.max(
      ...CURTAIN_CAST.map((m) => {
        const spec = PEEKER_SPECS[m.kind]
        return spec.sway + (spec.drifts ? DRIFT_ROLL : 0)
      })
    )
    expect(worst).toBeLessThanOrEqual(CURTAIN_MAX_SWAY + 1e-9)
  })

  it('hinges the bow at the feet, where the art puts them', () => {
    // A bow about the chest swings the feet out behind the figure. The hinge is the MEASURED
    // bottom of the mascot envelope, so it follows the art rather than being matched by eye — and
    // the fold about it can only lift the figure, so the swept envelope never drops much below the
    // feet (what little it does is the inward roll, not the fold).
    expect(CURTAIN_FOOT_Y).toBe(-MASCOT_BOX.down)
    for (const side of [-1, 1] as Side[]) {
      expect(curtainFigureBox(side).y0).toBeGreaterThan(CURTAIN_FOOT_Y - 0.5)
    }
  })
})

describe('the pull-back', () => {
  /**
   * The reason this staging is the diorama rather than the proscenium, as arithmetic: the cast is
   * world-space at a plane BEHIND the world, so it recedes with it — and because the planet's
   * angular radius shrinks slightly FASTER than 1/D while the ring shrinks exactly as 1/(D+setback),
   * the clearance between them can only improve as the camera pulls back. The bow composed at the
   * still beat is therefore the bow at the bottom of the track, only smaller.
   */
  it('never closes the gap between the cast and the world as the camera pulls back', () => {
    const restRing = 1 / curtainRowDistance(0)
    const restPlanet = Math.asin(PLANET_RADIUS / CAMERA_DISTANCE)
    let previous = 1
    for (let i = 0; i <= 20; i++) {
      const progress = 1 + (ZOOM_START + (i / 20) * (1 - ZOOM_START)) * ENDING_SPAN
      const eye = cameraPositionAt(progress)
      const d = Math.hypot(eye[0], eye[1], eye[2])
      const ring = 1 / (d + CURTAIN_SET_BACK) / restRing
      const planet = Math.asin(PLANET_RADIUS / d) / restPlanet
      // the ring keeps MORE of its size than the planet does, so it separates rather than closes
      expect(ring / planet).toBeGreaterThanOrEqual(previous - 1e-12)
      previous = ring / planet
    }
    expect(previous).toBeGreaterThan(1.1)
  })

  /**
   * ...and the number T65 needs. The cast is static in world space, so what it occupies is a fixed
   * volume rather than something that has to be re-derived per zoom stop. A desk surface below
   * `minY` clears the whole company at every stop by construction.
   */
  it('reports a fixed world-space reach for the desk to clear', () => {
    const reach = curtainWorldReach(1440 / 900, CAMERA_FOV)
    expect(reach).not.toBeNull()
    expect(reach!.minY).toBeLessThan(-PLANET_RADIUS)
    expect(reach!.minY).toBeGreaterThan(-9)
    expect(reach!.radius).toBeLessThan(13)
  })

  it('scales a back row down as well as away, so a crowd reads as depth', () => {
    for (let row = 1; row < CURTAIN_ROWS; row++) {
      expect(curtainRowScale(row)).toBeLessThan(curtainRowScale(row - 1))
      expect(curtainRowDistance(row)).toBeGreaterThan(curtainRowDistance(row - 1))
    }
    // ...and a row's smaller screen size is what keeps the layout's clearance conservative: the
    // slots were solved at the front row's size, so anything behind is strictly smaller than the
    // envelope the frame and world checks were run against.
    expect(curtainRowScale(0)).toBe(1)
  })
})

describe('inputs the layout is derived from', () => {
  it('spends the packing budget in figure-widths, not composition-widths', () => {
    // The dressings are allowed to interleave (two neighbouring islands read as one piece of
    // ground); the figures are not. If this ever inverted, the cast would shrink for no reason.
    for (const side of [-1, 1] as Side[]) {
      const fig = curtainFigureBox(side)
      const comp = curtainCompositionBox(side)
      expect(comp.x1 - comp.x0).toBeGreaterThan(fig.x1 - fig.x0)
    }
    expect(CURTAIN_PACK).toBeGreaterThan(1)
  })

  it('keeps a real margin between a face and the world it stands against', () => {
    expect(CURTAIN_WORLD_MARGIN).toBeGreaterThan(0.045)
    const b = curtainBlocked(0, 0)!
    expect(b.top).toBeCloseTo(Math.max(ENDING_TOP[16], ENDING_TOP[17]) + CURTAIN_WORLD_MARGIN, 6)
  })
})
