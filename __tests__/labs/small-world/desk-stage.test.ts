import { describe, expect, it } from 'vitest'
import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_PITCH_DEG,
  DESK_EDGE_V,
  DESK_FRAME,
  ENDING_AIM_DROP,
  GLOBE_FRAME,
  STAND_GAP,
  ZOOM_FACTOR,
  globeEdgesAt,
  ndcYAt,
} from '@/components/labs/small-world/scene/camera'
import { PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'
import {
  DESK_BACK_Z,
  DESK_CLEARANCE,
  DESK_HALF_W,
  DESK_MAX_ASPECT,
  DESK_NEAR_Z,
  EDGE_WOBBLE,
  DESK_STAGE_EXIT_Z,
  DESK_NOTE,
  DESK_PROPS,
  DESK_TOP_Y,
  deskNoteFits,
  deskPropFits,
  journeyFloorY,
  propCeiling,
} from '@/components/labs/small-world/scene/desk-stage'

/**
 * THE FRUSTUM PROOF (Task 65).
 *
 *   The desk is mounted for the whole visit and the journey's camera never sees one pixel of it.
 *
 * The desk pays no zoom gate, no fade and no mount/unmount for that — it is simply parked outside
 * the frame — so the claim has to be carried by a proof rather than by a flag someone could get
 * wrong later. Everything below re-derives the frame from the SHIPPED camera constants using the
 * real frustum corner rays, exactly as Task 63's sky bench did. Nothing here reads desk-stage's own
 * projection helpers; if it did, it would only be checking the module against itself.
 */

const PITCH = (CAMERA_PITCH_DEG * Math.PI) / 180
const CAM_Y = CAMERA_DISTANCE * Math.sin(PITCH)
const CAM_Z = CAMERA_DISTANCE * Math.cos(PITCH)
const TAN_HALF = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** Every aspect the lab is plausibly read at, plus two nobody has. */
const ASPECTS: readonly (readonly [string, number])[] = [
  ['phone 390x844', 390 / 844],
  ['narrow 430x932', 430 / 932],
  ['tablet 820x1180', 820 / 1180],
  ['laptop 1280x800', 1280 / 800],
  ['desktop 1440x900', 1440 / 900],
  ['ultrawide 3440x1440', 3440 / 1440],
  ['absurd 5120x1440', 5120 / 1440],
]

/** The rig at a zoom scale: on the ray, aimed at the origin, up = +y, no roll. */
function rig(k: number) {
  const d = CAMERA_DISTANCE * k
  return {
    cam: [0, d * Math.sin(PITCH), d * Math.cos(PITCH)] as const,
    fwd: [0, -Math.sin(PITCH), -Math.cos(PITCH)] as const,
    right: [1, 0, 0] as const,
    up: [0, Math.cos(PITCH), -Math.sin(PITCH)] as const,
    dist: d,
  }
}

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function ndc(p: readonly number[], k: number, aspect: number) {
  const r = rig(k)
  const v = [p[0] - r.cam[0], p[1] - r.cam[1], p[2] - r.cam[2]]
  const depth = dot(v, r.fwd)
  return { x: dot(v, r.right) / (depth * TAN_HALF * aspect), y: dot(v, r.up) / (depth * TAN_HALF), depth }
}

/** Where the two BOTTOM corner rays cross the plane z = const. */
function floorFromCornerRays(z: number, aspect: number): number[] {
  const r = rig(1)
  return [-1, 1].map((cr) => {
    const d = [
      r.fwd[0] + TAN_HALF * (-r.up[0] + cr * aspect * r.right[0]),
      r.fwd[1] + TAN_HALF * (-r.up[1] + cr * aspect * r.right[1]),
      r.fwd[2] + TAN_HALF * (-r.up[2] + cr * aspect * r.right[2]),
    ]
    return r.cam[1] + ((z - r.cam[2]) / d[2]) * d[1]
  })
}

describe('the journey camera cannot see the desk', () => {
  it('has a bottom edge that the corner rays and journeyFloorY agree on, at every aspect', () => {
    for (const [, aspect] of ASPECTS) {
      for (const z of [-4, 0, 4, 6.692, 10, 18]) {
        const [left, right] = floorFromCornerRays(z, aspect)
        // no roll, so the two bottom corners sit at the same height — that is what makes the
        // bottom of the frame a function of z alone
        expect(left).toBeCloseTo(right, 12)
        expect(left).toBeCloseTo(journeyFloorY(z), 12)
      }
    }
  })

  it('puts the WHOLE slab below ndc_y = -1 at the rest camera, at every aspect', () => {
    let worstNdc = -Infinity
    for (const [name, aspect] of ASPECTS) {
      for (let i = 0; i <= 60; i++) {
        const z = DESK_BACK_Z + (i / 60) * (DESK_NEAR_Z - DESK_BACK_Z)
        for (let j = 0; j <= 60; j++) {
          const x = -DESK_HALF_W + (j / 60) * 2 * DESK_HALF_W
          const n = ndc([x, DESK_TOP_Y, z], 1, aspect)
          if (n.depth <= 0) continue // behind the camera: not rendered, and not a leak
          worstNdc = Math.max(worstNdc, n.y)
          expect(n.y, `${name} leaks the desk at x=${x.toFixed(1)} z=${z.toFixed(2)}`).toBeLessThan(-1)
        }
      }
    }
    // and it is not a squeak: the worst point on the whole slab sits a real margin below the edge
    expect(worstNdc).toBeLessThan(-1.05)
  })

  it('is the CLEARANCE that buys that — remove it and the back edge leaks', () => {
    // mutation, made against the same corner-ray frame: a slab authored with no clearance sits
    // exactly ON the bottom edge, and one authored above it is visible.
    const flush = DESK_BACK_Z - DESK_CLEARANCE / Math.tan(PITCH + (CAMERA_FOV * Math.PI) / 360)
    expect(ndc([0, DESK_TOP_Y, flush], 1, 16 / 10).y).toBeCloseTo(-1, 6)
    expect(ndc([0, DESK_TOP_Y + 0.4, DESK_BACK_Z], 1, 16 / 10).y).toBeGreaterThan(-1)
  })

  it('contains every authored prop, and the note, at its own back', () => {
    for (const p of DESK_PROPS) {
      expect(deskPropFits(p), `${p.kind} at x=${p.x} z=${p.z} tops out above the frame`).toBe(true)
    }
    expect(deskNoteFits()).toBe(true)
  })

  it('holds every prop below ndc_y = -1 as a SOLID, not as a point', () => {
    // deskPropFits is a scalar rule; this is the same claim made the expensive way — sweep each
    // prop's whole bounding box through the real projection at every aspect.
    for (const [name, aspect] of ASPECTS) {
      for (const p of DESK_PROPS) {
        for (const dz of [-p.backReach, 0, p.backReach]) {
          for (const dx of [-p.backReach, 0, p.backReach]) {
            for (const y of [DESK_TOP_Y, DESK_TOP_Y + p.top]) {
              const n = ndc([p.x + dx, y, p.z + dz], 1, aspect)
              if (n.depth <= 0) continue
              expect(n.y, `${name}: ${p.kind} at z=${p.z} leaks`).toBeLessThan(-1)
            }
          }
        }
      }
    }
  })

  it('leaves NO room over the props it authored — the ceiling is really the binding constraint', () => {
    // If every prop could be twice as tall the gate would be decoration. Found by MEASUREMENT
    // rather than by naming kinds: Task 65 named the dish and the lamp, and when Task 66 deleted
    // one and dropped the other the filter went empty and the test passed on nothing. Whichever
    // pieces are currently closest to their own ceiling are the ones that have to fail when raised
    // to it.
    const byHeadroom = [...DESK_PROPS].sort(
      (a, b) => propCeiling(a.z - a.backReach) - a.top - (propCeiling(b.z - b.backReach) - b.top)
    )
    // ONE piece has to be genuinely against it — the claim is that the ceiling binds SOMEWHERE,
    // not that every prop is a near-miss, and a set where several crowd the line is a set with no
    // composition left in it.
    const tight = byHeadroom.slice(0, 1)
    for (const p of tight) {
      const ceiling = propCeiling(p.z - p.backReach)
      expect(p.top).toBeLessThan(ceiling)
      expect(deskPropFits({ ...p, top: ceiling + 1e-6 })).toBe(false)
      // and they are genuinely near it, rather than near it by accident of being short
      expect(ceiling - p.top).toBeLessThan(0.45)
    }
  })
})

describe('the desk is derived from the camera, not typed next to it', () => {
  it('parks its back edge exactly one clearance below the journey frame', () => {
    expect(journeyFloorY(DESK_BACK_Z) - DESK_TOP_Y).toBeCloseTo(DESK_CLEARANCE, 12)
  })

  it('runs past the point the surface leaves the bottom of the money shot', () => {
    // the plane's exit z at full pull-back, from the corner-ray frame
    let exit = DESK_BACK_Z
    for (let i = 0; i <= 20000; i++) {
      const z = DESK_BACK_Z + (i / 20000) * 40
      if (ndc([0, DESK_TOP_Y, z], ZOOM_FACTOR, 16 / 10).y < -1) {
        exit = z
        break
      }
    }
    expect(DESK_NEAR_Z).toBeGreaterThan(exit)
    // and it is not absurdly past it either — this is a slab, not a floor
    expect(DESK_NEAR_Z - exit).toBeLessThan(4)
  })

  it('is wide enough that no aspect up to DESK_MAX_ASPECT can see a side edge', () => {
    for (const [name, aspect] of ASPECTS) {
      expect(aspect).toBeLessThan(DESK_MAX_ASPECT)
      for (const k of [1, 1.5, 2, 2.5, ZOOM_FACTOR]) {
        for (let i = 0; i <= 40; i++) {
          const z = DESK_BACK_Z + (i / 40) * (DESK_NEAR_Z - DESK_BACK_Z)
          const n = ndc([DESK_HALF_W, DESK_TOP_Y, z], k, aspect)
          if (n.depth <= 0 || n.y > -1) continue // off the bottom of the frame: no edge to see
          expect(n.x, `${name} sees the desk's side edge at k=${k} z=${z.toFixed(1)}`).toBeGreaterThan(1)
        }
      }
    }
  })
})

describe('the money shot, as the three targets it is solved from', () => {
  it('stands the world at GLOBE_FRAME of the frame height', () => {
    const g = globeEdgesAt(ZOOM_FACTOR, ENDING_AIM_DROP)
    // The solve for ZOOM_FACTOR is closed-form and ON AXIS; the aim drop puts the world off axis,
    // which inflates a rectilinear projection slightly. Both the target and the realised value are
    // checked, and the realised one is what has to sit inside Aram's band.
    expect((g.top - g.bot) / 2).toBeGreaterThan(0.33)
    expect((g.top - g.bot) / 2).toBeLessThan(0.4)
    expect((g.top - g.bot) / 2).toBeCloseTo(GLOBE_FRAME, 2)
    // ...and at rest it is the size it always was — the pull-back is the only thing that shrinks it
    const rest = globeEdgesAt(1, 0)
    expect((rest.top - rest.bot) / 2).toBeCloseTo(0.537, 3)
  })

  it('gives the desk DESK_FRAME of the frame, with the stand band between them', () => {
    const edge = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z], ZOOM_FACTOR, ENDING_AIM_DROP)
    expect(edge).toBeCloseTo(DESK_EDGE_V, 6)
    expect((1 + edge) / 2).toBeCloseTo(DESK_FRAME, 6)
    // the band the stand stands in is exactly what was asked for, not what was left over
    expect(globeEdgesAt(ZOOM_FACTOR, ENDING_AIM_DROP).bot - edge).toBeCloseTo(STAND_GAP, 6)
  })

  it('records what the DRAWN edge does, which is not quite what the solved one does', () => {
    // The slab's back edge is hand formed and wanders forward, so the boundary the eye sees is
    // below the boundary DESK_TOP_Y was solved against — by half the wobble on average and by the
    // whole of it at worst. The composition is NOT re-solved against it (that costs half a world
    // unit of prop headroom, which the pencil cup and the figurines do not have); the difference is
    // recorded here instead, so the shortfall is a number in a test rather than a surprise.
    const mean = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z + EDGE_WOBBLE / 2], ZOOM_FACTOR, ENDING_AIM_DROP)
    const worst = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z + EDGE_WOBBLE], ZOOM_FACTOR, ENDING_AIM_DROP)
    expect((1 + mean) / 2).toBeGreaterThan(DESK_FRAME - 0.025)
    expect((1 + mean) / 2).toBeLessThan(DESK_FRAME)
    // ...and even at its lowest the drawn edge stays below the world, so nothing cuts the sphere
    expect(worst).toBeLessThan(globeEdgesAt(ZOOM_FACTOR, ENDING_AIM_DROP).bot)
  })

  it('is the AIM that spends the white space, which is why the zoom alone could not', () => {
    // Aram's complaint measured: the share of the centre column that is neither world nor desk.
    const skyAt = (zoom: number, aim: number, topY: number) => {
      const back = CAM_Z - (CAM_Y - topY - DESK_CLEARANCE) / Math.tan(PITCH + (CAMERA_FOV * Math.PI) / 360)
      const g = globeEdgesAt(zoom, aim)
      const edge = ndcYAt([0, topY, back], zoom, aim)
      return (2 - (g.top - g.bot) - (edge + 1)) / 2
    }
    // Round 20's geometry, and the same geometry with only the zoom reduced: no improvement.
    expect(skyAt(3, 0, 0)).toBeCloseTo(0.435, 2)
    expect(skyAt(ZOOM_FACTOR, 0, 0)).toBeGreaterThan(0.4)
    // ...and the shipped composition, which is the thing that actually answers the note.
    expect(skyAt(ZOOM_FACTOR, ENDING_AIM_DROP, DESK_TOP_Y)).toBeLessThan(0.28)
  })

  it('holds the desk BELOW the world rather than cutting into it', () => {
    // A desk edge above the world's bottom would slice the silhouette — the world would read as
    // sunk into the table rather than standing on it, and it would hide the cradle completely.
    for (let i = 0; i <= 200; i++) {
      const zoom = i / 200
      const s = zoom * zoom * (3 - 2 * zoom)
      const k = Math.exp(Math.log(ZOOM_FACTOR) * s)
      const aim = ENDING_AIM_DROP * s
      const edge = ndcYAt([0, DESK_TOP_Y, DESK_BACK_Z], k, aim)
      expect(edge, `the desk cuts the world at k=${k.toFixed(3)}`).toBeLessThan(
        globeEdgesAt(k, aim).bot
      )
    }
  })
})

describe('the wedge nothing can cross', () => {
  it('is a real gap between the planet and the bottom of the journey frame', () => {
    // The planet's lower tangent leaves the camera at pitch + asin(R/D); the frame's bottom edge at
    // pitch + fov/2. Between them is sky the journey shows for six chapters — and it is exactly why
    // no static prop can be built up to touch the world.
    const tangent = PITCH + Math.asin(PLANET_RADIUS / CAMERA_DISTANCE)
    const bottom = PITCH + (CAMERA_FOV * Math.PI) / 360
    expect(bottom).toBeGreaterThan(tangent)
    const wedgeFraction = (bottom - tangent) / ((CAMERA_FOV * Math.PI) / 180)
    expect(wedgeFraction).toBeGreaterThan(0.2)
    // so anything reaching the planet's silhouette from below is, necessarily, in frame at rest
    const reachUp = ndc([0, -PLANET_RADIUS, 0], 1, 16 / 10)
    expect(reachUp.y).toBeGreaterThan(-1)
  })
})

describe('the note', () => {
  it('sits in the core band, clear of the dish, and inside the desk', () => {
    expect(Math.abs(DESK_NOTE.x)).toBeLessThan(1.5)
    // it lies ON the blotter rather than beside it — the mat is what groups the ending's core
    const mat = DESK_PROPS.find((p) => p.kind === 'mat')!
    expect(DESK_NOTE.z - DESK_NOTE.depth / 2).toBeGreaterThan(mat.z - mat.backReach)
    expect(DESK_NOTE.z + DESK_NOTE.depth / 2).toBeLessThan(mat.z + mat.backReach)
    expect(DESK_NOTE.width / 2).toBeLessThan(mat.halfW!)
    expect(DESK_NOTE.z + DESK_NOTE.depth / 2).toBeLessThan(DESK_NEAR_Z)
    expect(DESK_NOTE.width / 2).toBeLessThan(DESK_HALF_W)
  })

  it('stays inside the money shot instead of falling off its bottom edge', () => {
    // Task 65 parked the sheet at z = 13.1, which the Task 66 frame leaves a whole world unit
    // BELOW the bottom of the screen. Gated against the shipped exit rather than eyeballed.
    expect(DESK_NOTE.z + DESK_NOTE.depth / 2).toBeLessThan(DESK_STAGE_EXIT_Z)
  })

  it('is readable on the narrowest frame — it fills most of it rather than most of a desktop', () => {
    const aspect = 430 / 932
    const halfFrame = ndc([0, DESK_TOP_Y, DESK_NOTE.z], ZOOM_FACTOR, aspect)
    const fraction = DESK_NOTE.width / 2 / (halfFrame.depth * TAN_HALF * aspect)
    expect(fraction).toBeGreaterThan(0.6)
    expect(fraction).toBeLessThan(1)
  })
})
