'use client'
import * as THREE from 'three'
import type { SkillCategory } from '@/types'
import { makePSXMaterial } from './psx-materials'
import {
  mulberry32,
  makePlywoodTexture,
  makeCRTScreenTexture,
  makeStickerSheetTexture,
  makeMemcardTexture,
  makeBoxSpineTexture,
  makeTVScreenTexture,
  makeDeckTexture,
  makeWindowViewTexture,
  makePosterTexture,
  makeCorkboardTexture,
  makeConcreteTexture,
} from './textures'

/**
 * Pure THREE.Group builders for the dev room — primitives only, each mesh a
 * Lambert PSX material. Every builder is self-contained (creates its own
 * textures/materials); room.tsx places the groups and disposes the tree on
 * unmount. No React, no side effects beyond the returned scene graph.
 *
 * Tone law: prop bodies are crude era neutrals (beige plastic, grey, dark
 * rubber); saturation only enters through the landed graphic textures
 * (posters, sticker sheet, deck, spines, screens). Crash trick: hotspot props
 * get a brighter vertex-AO floor (`LO.hot`) than set dressing (`LO.dress`), so
 * the clickable objects sit a contrast step above the room.
 */

/** Shared dims (metres). Placement lives in room.tsx; these are prop-local. */
export const BUILD = {
  deskTop: { w: 1.7, h: 0.06, d: 0.7 },
  deskH: 0.95,
  crt: { w: 0.5, h: 0.42, d: 0.42 },
  tower: { w: 0.22, h: 0.62, d: 0.5 },
  shelf: { w: 0.28, h: 0.05, len: 1.6 },
  gamebox: { w: 0.014, h: 0.16, d: 0.13 },
  memcard: { w: 0.11, h: 0.15, d: 0.02 },
  tv: { w: 0.62, h: 0.5, d: 0.5, standH: 0.22 },
  deck: { w: 0.22, h: 0.85, d: 0.02 },
  window: { w: 1.3, h: 1.0, paneW: 1.1, paneH: 0.82 },
  poster: { w: 0.62, h: 0.93 },
} as const

/** Era-neutral prop palette — no accents here (those come from textures). */
const BEIGE = '#cbc4b2' // CRT / tower / TV plastic
const GREY = '#b4b0a4' // keyboard / memcard / console shells
const DARK = '#3c3f3c' // rubber, bezel inner, cables
const CERAMIC = '#c7c1b2' // mug
const DISC = '#b9b6ad' // CD platters

/** Vertex-AO floor: how dark a prop's underside goes. Hotspots stay brighter. */
const LO = { hot: 0.84, prop: 0.7, dress: 0.62, leg: 0.5 } as const

// ── mesh factories ─────────────────────────────────────────────────────────

/** Darken a geometry toward its underside via a per-vertex grey ramp (cheap
 * baked AO). `lo` is the bottom brightness; the top stays full white. */
function heightTint(geo: THREE.BufferGeometry, lo: number): void {
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox!
  const range = max.y - min.y || 1
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const c = lo + (1 - lo) * ((pos.getY(i) - min.y) / range)
    col[i * 3] = c
    col[i * 3 + 1] = c
    col[i * 3 + 2] = c
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

type MeshOpts = {
  map?: THREE.Texture
  color?: string
  lo?: number
  name?: string
  transparent?: boolean
}

function meshFrom(geo: THREE.BufferGeometry, o: MeshOpts): THREE.Mesh {
  const vertexColors = o.lo !== undefined
  if (vertexColors) heightTint(geo, o.lo!)
  const material = makePSXMaterial({ map: o.map, color: o.color, vertexColors })
  if (o.transparent) {
    material.transparent = true
    material.depthWrite = false
  }
  const mesh = new THREE.Mesh(geo, material)
  if (o.name) mesh.name = o.name
  return mesh
}

const box = (w: number, h: number, d: number, o: MeshOpts = {}) =>
  meshFrom(new THREE.BoxGeometry(w, h, d), o)

const plane = (w: number, h: number, o: MeshOpts = {}) =>
  meshFrom(new THREE.PlaneGeometry(w, h), o)

const cyl = (rt: number, rb: number, h: number, seg: number, o: MeshOpts = {}) =>
  meshFrom(new THREE.CylinderGeometry(rt, rb, h, seg), o)

/** Set the same hotspot id on a group and all its meshes, so a raycast against
 * either the group or a leaf resolves to the hotspot. */
function nameAll(root: THREE.Object3D, id: string): void {
  root.name = id
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.name = id
  })
}

const at = (m: THREE.Object3D, x: number, y: number, z: number) => {
  m.position.set(x, y, z)
  return m
}

// ── ground-contact shadow decal ─────────────────────────────────────────────

/** Seeded dark radial blob (transparent rim) for baked ground shadows. */
function makeBlobShadowTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2)
  grad.addColorStop(0, 'rgba(20,26,25,0.62)')
  grad.addColorStop(0.6, 'rgba(20,26,25,0.34)')
  grad.addColorStop(1, 'rgba(20,26,25,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** A flat quantized shadow ellipse to sit just above the carpet (y≈0.02). The
 * era baked these; nothing casts real shadows in this scene. */
export function buildShadow(w: number, d: number): THREE.Group {
  const grp = new THREE.Group()
  const m = plane(w, d, { map: makeBlobShadowTexture(), color: '#ffffff', transparent: true })
  m.rotation.x = -Math.PI / 2
  m.renderOrder = 1
  grp.add(m)
  return grp
}

// ── desk cluster ─────────────────────────────────────────────────────────────

/** Plywood desk: top slab on four legs, origin at floor level, top at deskH. */
export function buildDesk(): THREE.Group {
  const grp = new THREE.Group()
  const ply = makePlywoodTexture()
  ply.repeat.set(2, 1)
  const { w, h, d } = BUILD.deskTop
  const topY = BUILD.deskH - h / 2
  grp.add(at(box(w, h, d, { map: ply, lo: LO.prop }), 0, topY, 0))
  // A back rail + modesty panel add mass so the desk reads solid, not a table.
  grp.add(at(box(w, 0.18, 0.04, { map: ply, lo: LO.dress }), 0, topY - 0.16, -d / 2 + 0.03))
  const legY = (BUILD.deskH - h) / 2
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      grp.add(at(box(0.07, BUILD.deskH - h, 0.07, { color: '#7c6446', lo: LO.leg }),
        sx * (w / 2 - 0.09), legY, sz * (d / 2 - 0.09)))
  return grp
}

/** Beige CRT on a tilt base; screen plane carries the `crt` hotspot id. */
export function buildCRT(): THREE.Group {
  const grp = new THREE.Group()
  const { w, h, d } = BUILD.crt
  grp.add(at(box(w + 0.02, 0.05, d, { color: BEIGE, lo: LO.prop }), 0, 0.025, 0))
  grp.add(at(box(w, h, d, { color: BEIGE, lo: LO.hot }), 0, 0.05 + h / 2, 0))
  // Recessed dark bezel + the lit screen, proud of the front face (+z).
  grp.add(at(box(w - 0.05, h - 0.06, 0.02, { color: DARK, lo: LO.prop }), 0, 0.05 + h / 2, d / 2))
  const screen = at(plane(w - 0.12, h - 0.13, { map: makeCRTScreenTexture(), color: '#ffffff', name: 'crt' }),
    0, 0.05 + h / 2, d / 2 + 0.012)
  grp.add(screen)
  return grp
}

/** Tower PC standing on the floor, skate-sticker decal on its room-facing (+z) side. */
export function buildTower(): THREE.Group {
  const grp = new THREE.Group()
  const { w, h, d } = BUILD.tower
  grp.add(at(box(w, h, d, { color: BEIGE, lo: LO.prop }), 0, h / 2, 0))
  grp.add(at(plane(w - 0.02, h - 0.12, { map: makeStickerSheetTexture(), color: '#ffffff', transparent: true }),
    0, h / 2, d / 2 + 0.002))
  grp.add(at(box(0.02, 0.02, 0.01, { color: '#7de8e0' }), w / 2 - 0.04, h - 0.08, d / 2)) // power LED
  return grp
}

/** Grey keyboard slab with a darker key well; origin at desk surface. */
export function buildKeyboard(): THREE.Group {
  const grp = new THREE.Group()
  grp.add(at(box(0.44, 0.03, 0.16, { color: GREY, lo: LO.prop }), 0, 0.015, 0))
  grp.add(at(box(0.4, 0.012, 0.12, { color: '#8f8b80', lo: LO.dress }), 0, 0.032, 0.005))
  grp.add(at(box(0.1, 0.025, 0.14, { color: GREY, lo: LO.prop }), 0.42, 0.0125, 0.0)) // ball mouse
  return grp
}

/** Pager on the desk — body carries the `pager` hotspot id + a tiny LCD. */
export function buildPager(): THREE.Group {
  const grp = new THREE.Group()
  grp.add(at(box(0.09, 0.035, 0.13, { color: DARK, lo: LO.hot, name: 'pager' }), 0, 0.0175, 0))
  grp.add(at(plane(0.06, 0.03, { map: undefined, color: '#8fb98f' }), 0, 0.036, 0.01)) // LCD
  grp.add(at(box(0.02, 0.02, 0.04, { color: '#6a6d6a' }), 0, 0.03, -0.07)) // belt clip
  return grp
}

// ── shelf: memory cards (projects) + game boxes (labs) ──────────────────────

/** Wall shelf carrying 3 memory cards and 5 game-box spines. Cards and boxes
 * each form a named hotspot group (`memcards`, `gameboxes`). Built oriented for
 * the +x wall: plank long axis on z, spines facing the room (−x). */
export function buildShelf(): THREE.Group {
  const grp = new THREE.Group()
  const ply = makePlywoodTexture()
  ply.repeat.set(1, 3)
  const { w, h, len } = BUILD.shelf
  grp.add(at(box(w, h, len, { map: ply, lo: LO.prop }), 0, 0, 0)) // plank, top at y=h/2
  const top = h / 2

  const boxes = new THREE.Group()
  const g = BUILD.gamebox
  for (let i = 0; i < 5; i++) {
    const jc = new THREE.Group()
    jc.add(box(g.w, g.h, g.d, { color: GREY, lo: LO.prop }))
    // Spine graphic faces −x (toward the room / shelf camera).
    const spine = at(plane(g.d - 0.01, g.h - 0.02, { map: makeBoxSpineTexture(i), color: '#ffffff' }),
      -g.w / 2 - 0.002, 0, 0)
    spine.rotation.y = -Math.PI / 2
    jc.add(spine)
    at(jc, -w / 4, top + g.h / 2, -0.5 + i * 0.14)
    jc.rotation.z = (i % 2 ? 1 : -1) * 0.03 // a couple lean like real cases
    boxes.add(jc)
  }
  nameAll(boxes, 'gameboxes')
  grp.add(boxes)

  const cards = new THREE.Group()
  const m = BUILD.memcard
  const cardTex = makeMemcardTexture()
  for (let i = 0; i < 3; i++) {
    const card = box(m.w, m.h, m.d, { map: cardTex, color: '#ffffff' })
    at(card, w / 6, top + m.h / 2, 0.55 - i * 0.14)
    card.rotation.y = -Math.PI / 2 // big label face toward the room (−x)
    card.rotation.z = 0.05
    cards.add(card)
  }
  nameAll(cards, 'memcards')
  grp.add(cards)
  return grp
}

// ── floor TV zone ────────────────────────────────────────────────────────────

/** Tube TV on a stand + console + controller. Screen carries `tv`. Origin at
 * floor; the group is rotated by room.tsx to face the tv camera. */
export function buildTV(): THREE.Group {
  const grp = new THREE.Group()
  const { w, h, d, standH } = BUILD.tv
  grp.add(at(box(w + 0.08, standH, d, { color: '#6f5a3c', lo: LO.leg }), 0, standH / 2, 0)) // stand
  const bodyY = standH + h / 2
  grp.add(at(box(w, h, d, { color: BEIGE, lo: LO.prop }), 0, bodyY, 0))
  grp.add(at(box(w - 0.06, h - 0.08, 0.02, { color: DARK, lo: LO.prop }), 0, bodyY, d / 2))
  grp.add(at(plane(w - 0.14, h - 0.14, { map: makeTVScreenTexture(), color: '#ffffff', name: 'tv' }),
    0, bodyY, d / 2 + 0.012))
  // Console slab + a controller nub in front, on the floor.
  grp.add(at(box(0.34, 0.06, 0.24, { color: DARK, lo: LO.dress }), 0.05, 0.03, d / 2 + 0.22))
  grp.add(at(box(0.12, 0.03, 0.08, { color: '#57595a', lo: LO.prop }), -0.18, 0.02, d / 2 + 0.3))
  return grp
}

/** Skate deck slab with truck nubs — leans as a foreground occluder. Deck
 * graphic on the −z face; room.tsx tilts + places it. */
export function buildDeck(): THREE.Group {
  const grp = new THREE.Group()
  const { w, h, d } = BUILD.deck
  grp.add(box(w, h, d, { map: makePlywoodTexture(), lo: LO.prop }))
  // Deck graphic on the +z face (room.tsx leans this face toward the room).
  grp.add(at(plane(w - 0.02, h - 0.06, { map: makeDeckTexture(), color: '#ffffff' }), 0, 0, d / 2 + 0.001))
  for (const sy of [-1, 1])
    grp.add(at(box(0.12, 0.03, 0.05, { color: DARK }), 0, sy * (h / 2 - 0.12), -d / 2 - 0.02)) // truck nubs
  return grp
}

// ── wall dressing ────────────────────────────────────────────────────────────

/** Window frame + view pane + concrete sill; faces +z (the −z wall). */
export function buildWindow(): THREE.Group {
  const grp = new THREE.Group()
  const ply = makePlywoodTexture()
  const { w, h, paneW, paneH } = BUILD.window
  grp.add(box(w, h, 0.08, { map: ply, lo: LO.prop })) // frame slab
  grp.add(at(plane(paneW, paneH, { map: makeWindowViewTexture(), color: '#ffffff' }), 0, 0, 0.045))
  // Muntin cross dividing the pane into four lights.
  grp.add(at(box(0.03, paneH, 0.02, { map: ply, lo: LO.dress }), 0, 0, 0.05))
  grp.add(at(box(paneW, 0.03, 0.02, { map: ply, lo: LO.dress }), 0, 0, 0.05))
  grp.add(at(box(w + 0.14, 0.08, 0.18, { map: makeConcreteTexture(), lo: LO.dress }), 0, -h / 2 - 0.02, 0.06)) // sill
  return grp
}

/** Four skills posters spread across the −z and −x walls (world-placed inside
 * the group so a single `posters` hotspot spans both walls). */
export function buildPosters(halfX: number, halfZ: number): THREE.Group {
  const grp = new THREE.Group()
  const rnd = mulberry32(821)
  const { w, h } = BUILD.poster
  const back = -halfZ + 0.01
  const left = -halfX + 0.01
  // [category, x, y, z, rotY]
  const spots: Array<[SkillCategory, number, number, number, number]> = [
    ['frontend', -1.55, 1.78, back, 0],
    ['mobile', 0.42, 1.98, back, 0],
    ['state', left, 1.74, -1.0, Math.PI / 2],
    ['styling', left, 1.55, 0.35, Math.PI / 2],
  ]
  for (const [cat, x, y, z, ry] of spots) {
    const p = at(plane(w, h, { map: makePosterTexture(cat), color: '#ffffff' }), x, y, z)
    p.rotation.y = ry
    p.rotation.z = (rnd() - 0.5) * 0.05 // taped-on tilt
    grp.add(p)
  }
  nameAll(grp, 'posters')
  return grp
}

/** Corkboard with a thin frame; faces +z. Not a hotspot (set dressing). */
export function buildCorkboard(): THREE.Group {
  const grp = new THREE.Group()
  grp.add(box(1.04, 0.82, 0.03, { color: '#6b5836', lo: LO.dress })) // frame
  grp.add(at(plane(0.98, 0.76, { map: makeCorkboardTexture(), color: '#ffffff' }), 0, 0, 0.02))
  return grp
}

// ── scattered clutter ────────────────────────────────────────────────────────

/** CD spindle (squashed cylinder stack), mug, and cable crate around the desk
 * corner. The loose CD cases live in room.tsx's floor clutter (scattered into
 * the establishing shot's mid-floor). Positioned prop-local; room.tsx places it. */
export function buildClutter(): THREE.Group {
  const grp = new THREE.Group()
  const s = BUILD.deskH

  // CD spindle on the desk: a rod through a stack of thin platters.
  const spindle = new THREE.Group()
  spindle.add(at(cyl(0.012, 0.012, 0.2, 6, { color: DARK }), 0, 0.1, 0))
  for (let i = 0; i < 9; i++)
    spindle.add(at(cyl(0.09, 0.09, 0.012, 12, { color: DISC, lo: LO.dress }), 0, 0.01 + i * 0.02, 0))
  grp.add(at(spindle, 0.62, s, 0.12))

  // Mug on the desk.
  const mug = new THREE.Group()
  mug.add(cyl(0.045, 0.04, 0.09, 10, { color: CERAMIC, lo: LO.prop }))
  mug.add(at(box(0.02, 0.05, 0.02, { color: CERAMIC }), 0.05, 0, 0))
  grp.add(at(mug, 0.5, s + 0.045, -0.12))

  // Cable crate on the floor beside the desk.
  const crate = new THREE.Group()
  crate.add(box(0.22, 0.14, 0.16, { color: DARK, lo: LO.leg }))
  for (let i = 0; i < 2; i++) {
    const loop = at(cyl(0.03, 0.03, 0.02, 8, { color: '#2c2e2c' }), (i - 0.5) * 0.06, 0.08, 0)
    loop.rotation.x = Math.PI / 2
    crate.add(loop)
  }
  grp.add(at(crate, -0.85, 0.07, 0.28))
  return grp
}
