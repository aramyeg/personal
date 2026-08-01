import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { KEY_LIGHT_POSITION } from '../biome-atmosphere'
import type { ClayPart } from './clay-kit'
import { DESK_TOP_Y, type DeskProp } from '../desk-stage'

/**
 * THE THINGS ON THE DESK (Task 65) — clay primitives, in the lab's own vocabulary.
 *
 * Every builder here returns `ClayPart[]` in the prop's LOCAL frame (origin on the desk surface,
 * +y up) rather than JSX, for one reason that matters: `desk-set.tsx` concatenates all of them into
 * a single `buildMergedClay` call, so the entire desk set — dish, mug, pencil cup, books, plant,
 * lamp, loose pencils, paper clip, at every ring — costs ONE draw call. The parts carry their own
 * accent colours per-vertex, exactly as the checkpoint mascots do.
 *
 * THE HEIGHT CONTRACT. Every builder takes `top` and builds no vertex above it. That is not
 * decoration: `DESK_PROPS` publishes each prop's `top`, `desk-stage.test.ts` proves the published
 * heights sit under the journey camera's bottom frustum plane — and `desk-kit.test.ts` closes the
 * loop by MEASURING the geometry these builders actually emit against the number that was
 * published for it. Without that second half the containment suite would be a statement about a
 * data file rather than about the scene: a builder that quietly overshot its `top` by a leaf would
 * leave every assertion green and the desk leaking.
 *
 * Which is also why the parts come back with their transforms already BAKED into the geometry
 * rather than carried in `pos`/`rot`: a per-prop yaw composed onto a part's own Euler angles is
 * only correct when they commute, and half of these parts are tilted. The matrices are multiplied
 * in the honest order here, once, and what the measurement reads is what the scene draws.
 */

/** The blotter: a rounded slab of mat, flat enough that containment is never a question. */
function mat(top: number, halfW: number, halfD: number): ClayPart[] {
  const geo = new THREE.BoxGeometry(halfW * 2, top, halfD * 2)
  return [{ geo, color: PALETTE.deskMat, pos: [0, top / 2, 0], tag: 'mat' }]
}

/** A stoneware mug: barrel body, a ring handle, and something dark in it. */
function mug(top: number, tint: string): ClayPart[] {
  const r = top * 0.46
  return [
    { geo: new THREE.CylinderGeometry(r, r * 0.88, top, 18), color: tint, pos: [0, top / 2, 0] },
    {
      geo: new THREE.TorusGeometry(top * 0.24, top * 0.075, 7, 16),
      color: tint,
      pos: [r * 0.92, top * 0.58, 0],
      rot: [0, Math.PI / 2, 0],
      tag: 'mug-handle',
    },
    {
      geo: new THREE.CylinderGeometry(r * 0.88, r * 0.88, top * 0.04, 18),
      color: PALETTE.earthDeep,
      pos: [0, top * 0.96, 0],
      tag: 'mug-brew',
    },
  ]
}

/** A pencil cup: a straight beaker with four pencils fanning out of it. */
function pencilCup(top: number): ClayPart[] {
  const cupH = top * 0.5
  const r = top * 0.28
  const seat = cupH * 0.55
  const parts: ClayPart[] = [
    { geo: new THREE.CylinderGeometry(r, r * 0.92, cupH, 16), color: PALETTE.ice, pos: [0, cupH / 2, 0] },
    {
      geo: new THREE.CylinderGeometry(r * 0.9, r * 0.9, cupH * 0.06, 16),
      color: PALETTE.iceDeep,
      pos: [0, cupH * 0.98, 0],
    },
  ]
  const leans: [number, string][] = [
    [0.16, PALETTE.honey],
    [0.24, PALETTE.blossomDeep],
    [0.3, PALETTE.river],
    [0.09, PALETTE.meadow],
  ]
  leans.forEach(([lean, color], i) => {
    const yaw = (i / leans.length) * Math.PI * 2 + 0.4
    // Solve the length from where its TIP has to land rather than picking one and hoping: the
    // pencils fan to different heights between 0.84 and 0.97 of the prop's published ceiling.
    const tip = top * (0.84 + 0.13 * (i / (leans.length - 1)))
    const len = (tip - seat) / Math.cos(lean)
    parts.push({
      geo: new THREE.CylinderGeometry(top * 0.045, top * 0.045, len, 6),
      color,
      pos: [
        (Math.cos(yaw) * len * Math.sin(lean)) / 2,
        seat + (len / 2) * Math.cos(lean),
        (Math.sin(yaw) * len * Math.sin(lean)) / 2,
      ],
      rot: [Math.sin(yaw) * lean, 0, -Math.cos(yaw) * lean],
    })
  })
  return parts
}

/** A stack of books, each a flat slab with a paler block of pages down one side. */
function books(top: number, reach: number): ClayPart[] {
  const covers = [PALETTE.blossomDeep, PALETTE.pine, PALETTE.honey]
  const n = 3
  const h = top / n
  const parts: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const w = reach * 2 * (1 - i * 0.09)
    const d = reach * 1.25 * (1 - i * 0.07)
    const yaw = (i - 1) * 0.14
    parts.push({
      geo: new THREE.BoxGeometry(w, h * 0.98, d),
      color: covers[i % covers.length],
      pos: [i * 0.06, h * (i + 0.5), i * -0.05],
      rot: [0, yaw, 0],
    })
    parts.push({
      geo: new THREE.BoxGeometry(w * 0.9, h * 0.62, d * 0.9),
      color: PALETTE.notePaper,
      pos: [i * 0.06 + w * 0.04, h * (i + 0.5), i * -0.05],
      rot: [0, yaw, 0],
      tag: 'book-pages',
    })
  }
  return parts
}

/** A little potted plant: a tapered pot, soil, and a few paddle leaves on stems. */
function plant(top: number): ClayPart[] {
  const potH = top * 0.34
  const potR = top * 0.24
  const parts: ClayPart[] = [
    { geo: new THREE.CylinderGeometry(potR, potR * 0.74, potH, 14), color: PALETTE.clayPath, pos: [0, potH / 2, 0] },
    {
      geo: new THREE.TorusGeometry(potR, potR * 0.11, 6, 14),
      color: PALETTE.rust,
      pos: [0, potH * 0.96, 0],
      rot: [Math.PI / 2, 0, 0],
    },
    { geo: new THREE.CylinderGeometry(potR * 0.9, potR * 0.9, potH * 0.1, 14), color: PALETTE.earthDeep, pos: [0, potH, 0] },
  ]
  const leaves: [number, number, number][] = [
    [0.0, 0.42, 1.0],
    [2.2, 0.62, 0.82],
    [4.1, 0.3, 0.9],
    [1.1, 0.2, 0.7],
    [3.3, 0.5, 0.66],
  ]
  for (const [yaw, lean, size] of leaves) {
    const stemLen = (top - potH) * size
    const tipY = potH + stemLen * Math.cos(lean * 0.6)
    parts.push({
      geo: new THREE.CylinderGeometry(top * 0.018, top * 0.026, stemLen, 5),
      color: PALETTE.leaf,
      pos: [
        (Math.cos(yaw) * stemLen * Math.sin(lean * 0.6)) / 2,
        potH + (tipY - potH) / 2,
        (Math.sin(yaw) * stemLen * Math.sin(lean * 0.6)) / 2,
      ],
      rot: [Math.sin(yaw) * lean * 0.6, 0, -Math.cos(yaw) * lean * 0.6],
    })
    parts.push({
      geo: new THREE.SphereGeometry(top * 0.13 * size, 10, 8),
      color: size > 0.8 ? PALETTE.meadow : PALETTE.foliageDeep,
      pos: [
        Math.cos(yaw) * stemLen * Math.sin(lean * 0.6),
        Math.min(tipY, top - top * 0.055),
        Math.sin(yaw) * stemLen * Math.sin(lean * 0.6),
      ],
      scl: [1.5, 0.42, 1],
      rot: [0, -yaw, 0],
      tag: 'leaf',
    })
  }
  return parts
}

/** A desk lamp: weighted base, a leaning arm, a cone shade tipped toward the world. */
function lamp(top: number): ClayPart[] {
  const armLean = 0.34
  const baseH = top * 0.09
  // the arm's length follows from where its joint has to land — the joint IS the lamp's ceiling
  const armLen = (top - baseH - top * 0.055) / Math.cos(armLean)
  const headY = baseH + armLen * Math.cos(armLean)
  const headX = -armLen * Math.sin(armLean)
  const shadeR = top * 0.26
  return [
    { geo: new THREE.CylinderGeometry(top * 0.3, top * 0.34, baseH, 20), color: PALETTE.penguinBack, pos: [0, baseH / 2, 0] },
    {
      geo: new THREE.CylinderGeometry(top * 0.035, top * 0.045, armLen, 8),
      color: PALETTE.penguinBack,
      pos: [headX / 2, baseH + (armLen / 2) * Math.cos(armLean), 0],
      rot: [0, 0, armLean],
      tag: 'lamp-arm',
    },
    // the shade hangs BELOW the joint, tipped toward the world, so the joint stays the tallest point
    {
      geo: new THREE.ConeGeometry(shadeR, top * 0.26, 18, 1, true),
      color: PALETTE.honey,
      pos: [headX - shadeR * 0.5, headY - top * 0.3, 0],
      rot: [0, 0, Math.PI + armLean * 1.4],
      tag: 'lamp-shade',
    },
    { geo: new THREE.SphereGeometry(top * 0.055, 10, 8), color: PALETTE.penguinBack, pos: [headX, headY - top * 0.055, 0] },
  ]
}

/** A pencil lying flat across the desk. `reach` is half its length. */
function loosePencil(top: number, reach: number, tint: string): ClayPart[] {
  const r = top * 0.5
  return [
    {
      geo: new THREE.CylinderGeometry(r, r, reach * 1.7, 6),
      color: tint,
      pos: [0, r, 0],
      rot: [0, 0, Math.PI / 2],
    },
    {
      geo: new THREE.ConeGeometry(r, reach * 0.22, 6),
      color: PALETTE.dune,
      pos: [reach * 0.95, r, 0],
      rot: [0, 0, -Math.PI / 2],
      tag: 'pencil-tip',
    },
    { geo: new THREE.SphereGeometry(r * 0.95, 8, 6), color: PALETTE.tuff, pos: [-reach * 0.87, r, 0] },
  ]
}

/** A paper clip: a flattened ring lying on the desk. */
function clip(top: number, reach: number): ClayPart[] {
  return [
    {
      // radialSegments divisible by 4 so a vertex actually lands on the tube's crown — the ring's
      // published top is only real if the tessellation puts a point there
      geo: new THREE.TorusGeometry(reach * 0.72, top * 0.5, 8, 18),
      color: PALETTE.heronWing,
      pos: [0, top * 0.5, 0],
      rot: [Math.PI / 2, 0, 0],
      scl: [1, 0.6, 1],
    },
  ]
}

/** A soft contact pocket painted under a prop — the trick the polar bear's shadow is built on. */
function contact(reach: number): ClayPart {
  return {
    geo: new THREE.CircleGeometry(reach * 0.88, 20),
    color: PALETTE.deskShade,
    pos: [0, 0.006, reach * 0.16],
    rot: [-Math.PI / 2, 0, 0],
    scl: [1.2, 0.72, 1],
    tag: 'contact',
  }
}

/**
 * Rotate a surface's normals toward the key light.
 *
 * The desk's two big surfaces — the slab and the sheet — are horizontal, and a horizontal face
 * takes dot(N, L) = 0.28 from the lab's one key. On a four-step ramp that is the third band down,
 * about a fifth of the albedo, which is why the slab's first pass rendered as mustard. Tilting the
 * authored normal into the key puts both on the ramp's top band.
 *
 * This is a lie the eye cannot catch, and only because of what these surfaces ARE: they are flat,
 * so there is no shading gradient across them for a wrong normal to distort — a constant normal on
 * a plane produces exactly the constant tone a plane should have. `mix` keeps some of the true
 * normal so the note's curl still bends its own light. It would be wrong on anything curved, and
 * nothing curved uses it.
 */
export function tiltTowardKey(geo: THREE.BufferGeometry, mix: number) {
  const key = new THREE.Vector3(...KEY_LIGHT_POSITION).normalize()
  const normals = geo.attributes.normal
  const n = new THREE.Vector3()
  for (let i = 0; i < normals.count; i++) {
    n.fromBufferAttribute(normals, i).multiplyScalar(mix).addScaledVector(key, 1 - mix).normalize()
    normals.setXYZ(i, n.x, n.y, n.z)
  }
  normals.needsUpdate = true
}

/**
 * The note's own contact pocket, merged in with the props rather than drawn by the note component,
 * so the whole set still costs one draw. A sheet with nothing under it floats exactly as badly as
 * a mug does.
 */
export function deskNoteShadowPart(note: {
  x: number
  z: number
  width: number
  depth: number
  rot: number
  lift: number
}): ClayPart {
  const geo = new THREE.PlaneGeometry(note.width * 1.012, note.depth * 1.03)
  geo
    .rotateX(-Math.PI / 2)
    .rotateY(note.rot)
    // just above the blotter the sheet lies on, not above the bare desk
    .translate(note.x + 0.07, DESK_TOP_Y + note.lift - 0.012, note.z + 0.13)
  // slate rather than the desk's warm shade: this shadow falls on the BLOTTER, and a brown pocket
  // on a blue-grey mat reads as a mounted frame around the sheet instead of as shade under it
  return { geo, color: PALETTE.heronWing, tag: 'note-shadow' }
}

function localParts(p: DeskProp): ClayPart[] {
  switch (p.kind) {
    case 'mat':
      return mat(p.top, p.halfW ?? p.backReach, p.backReach)
    case 'mug':
      return mug(p.top, p.ring === 'far' ? PALETTE.sprout : PALETTE.blossom)
    case 'cup':
      return pencilCup(p.top)
    case 'books':
      return books(p.top, p.backReach * 0.72)
    case 'plant':
      return plant(p.top)
    case 'lamp':
      return lamp(p.top)
    case 'pencil':
      return loosePencil(p.top, p.backReach, p.ring === 'far' ? PALETTE.river : PALETTE.honey)
    case 'clip':
      return clip(p.top, p.backReach)
  }
}

/**
 * Every part of one prop, with its local transform AND the prop's own placement already baked into
 * the geometry. Callers hand the result straight to `buildMergedClay`, whose identity matrix then
 * does nothing — which is the point: the composition order is `place · yaw · localTRS`, written
 * once and multiplied here, rather than smuggled through two Euler triples that do not commute.
 */
export function deskPropParts(p: DeskProp): ClayPart[] {
  const NO_POCKET: DeskProp['kind'][] = ['pencil', 'clip', 'mat']
  const local = NO_POCKET.includes(p.kind)
    ? localParts(p)
    : [contact(p.backReach * 0.8), ...localParts(p)]

  const place = new THREE.Matrix4()
    .makeTranslation(p.x, DESK_TOP_Y, p.z)
    .multiply(new THREE.Matrix4().makeRotationY(p.rot ?? 0))

  return local.map((part) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(part.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(part.scl ?? [1, 1, 1]))
    )
    const geo = part.geo.index ? part.geo.toNonIndexed() : part.geo
    if (geo !== part.geo) part.geo.dispose()
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(place, m))
    return { geo, color: part.color, tag: part.tag }
  })
}
