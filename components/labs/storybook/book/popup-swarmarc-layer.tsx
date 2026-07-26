'use client'

/**
 * Renders the CARRIER SWARM (popup-swarmarc.ts): 28 graded hairline struts +
 * rider silhouettes as TWO merged dynamic meshes (one draw for all struts, one
 * for all riders — the pack's approved merged-geometry path, never 28 draws),
 * plus the visible STIR THE SWARM pull tab (one more draw). Riders sample ONE
 * shared sprite atlas (`<id>-atlas`, 8×8 cell grid): per-strut uv rects are
 * STATIC (cell + mirror flip baked at build), only positions rewrite per pose
 * tick. Kraft fallback when unpainted: sky-tinted hairline struts (#a9bccb,
 * the daisy trick) and kraft rider chips.
 *
 * Atlas cell convention (generate-art.mjs paints to this): cells 0–15 the 16
 * rider sprites, cell 16 the hairline strut swatch, cells 17–18 the tab's
 * bee-on-honey-drop handle (2 cells wide), cells 19–22 the printed banner.
 *
 * STIR tab (H2/H3/H6 hand laws, tabpiece grab idiom): drive channel
 * `<id>~stir` holds the stroke s ∈ [0, stroke] while grabbed; release decays
 * overdamped (~300 ms, tau 80 ms) back to 0. Fold-flat is untouchable: the
 * solver multiplies BOTH the wave term and the ripple by E(beta).
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneLayer } from '../content'
import { liveSpreadRole, spreadPageAnglesTilted, type PanelQuad } from './popup-mechanics'
import {
  solveSwarmArcPose,
  swarmStirTabQuad,
  SWARM_TAB_D0,
  SWARM_TAB_W,
  SWARM_TAB_Z0,
  SWARM_TAB_Z1,
  type SwarmArcGeom,
} from './popup-swarmarc'
import { kraftTints } from './paper-stock'
import { easeTurnWeighted } from './page-geometry'
import { sharedHandleMaterial, sharedPaperTexture } from './shared-procedural-textures'
import type { TurnFrame } from './use-turn-driver'
import { useArtSprite } from './use-layer-texture'
import { applyUvRect } from '../art-atlas'
import { useStorybookStore } from '../store'
import {
  beginGrabChannel,
  clearUserDrive,
  endGrabChannel,
  readDriveOverride,
  readUserDrive,
  writeUserDrive,
} from '../user-drive'
import { pointerLocalRay } from './user-drive-pointer'
import { projectPageD } from './handle-projection'
import { acceptsHandleHit, HANDLE_SLOP_FLAT } from './handle-hit'
import { NUDGE_SPAN_STROKE_FRAC, TAP_EPS, nudgeOffset } from './handle-nudge'
import { useHandleTap } from './use-handle-tap'

const FLAT_EPSILON = 0.02
/** Overdamped release time constant (s) — ~95% settled inside 300 ms. */
const RELEASE_TAU = 0.08
const RELEASE_EPS = 0.002
const ATLAS_GRID = 8

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** uv rect of one atlas cell (row 0 at the TOP of the image — canvas paint
 *  order), optionally `cells` wide / `cellsY` tall, optionally u-mirrored. */
function cellUvs(cell: number, cells: number, flip: boolean, cellsY = 1): [number, number][] {
  const cx = cell % ATLAS_GRID
  const cy = Math.floor(cell / ATLAS_GRID)
  const u0 = cx / ATLAS_GRID
  const u1 = (cx + cells) / ATLAS_GRID
  const v1 = 1 - cy / ATLAS_GRID
  const v0 = 1 - (cy + cellsY) / ATLAS_GRID
  const [a, b] = flip ? [u1, u0] : [u0, u1]
  // corner order [foot-in, foot-out, tip-out, tip-in]: u across, v foot→tip
  return [
    [a, v0],
    [b, v0],
    [b, v1],
    [a, v1],
  ]
}

/** One merged dynamic mesh over `count` quads with static uvs. */
function makeMergedQuads(count: number, uvs: Float32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(count * 4 * 3), 3)
  positions.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positions)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  const index = new Uint16Array(count * 6)
  for (let q = 0; q < count; q++) {
    const b = q * 4
    index.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6)
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  return geometry
}

/** The quad scaled about its own centroid — the coarse-pointer slop pad. */
function enlargeQuad(quad: PanelQuad, k: number): PanelQuad {
  const c = [0, 1, 2].map((a) => (quad[0][a] + quad[1][a] + quad[2][a] + quad[3][a]) / 4)
  return quad.map((p) => [
    c[0] + (p[0] - c[0]) * k,
    c[1] + (p[1] - c[1]) * k,
    c[2] + (p[2] - c[2]) * k,
  ]) as unknown as PanelQuad
}

function writeQuadAt(arr: Float32Array, q: number, quad: PanelQuad): void {
  for (let c = 0; c < 4; c++) {
    arr[(q * 4 + c) * 3] = quad[c][0]
    arr[(q * 4 + c) * 3 + 1] = quad[c][1]
    arr[(q * 4 + c) * 3 + 2] = quad[c][2]
  }
}

export function SwarmArcPopupLayer({
  layer,
  spreadIndex,
  frame,
  committedSpread,
}: {
  layer: SceneLayer & SwarmArcGeom
  spreadIndex: number
  frame: RefObject<TurnFrame | null>
  committedSpread: RefObject<number>
}) {
  const gl = useThree((s) => s.gl)
  const groupRef = useRef<THREE.Group>(null)
  const tabRef = useRef<THREE.Mesh>(null)
  const slopRef = useRef<THREE.Mesh>(null)
  const grabRef = useRef<{ sGrabStart: number; dGrab: number } | null>(null)
  const tap = useHandleTap()
  const stirRef = useRef(0)
  const { texture: atlasArt, rect } = useArtSprite(`${layer.id}-atlas`)
  const tint = useMemo(() => kraftTints(`${layer.id}-atlas`), [layer.id])
  const stirChannel = `${layer.id}~stir`
  const n = layer.struts.length

  const readAngles = () => {
    const f = frame.current
    const role = liveSpreadRole(spreadIndex, committedSpread.current, f?.dir ?? null)
    const { thetaL, thetaR } = spreadPageAnglesTilted(
      spreadIndex,
      committedSpread.current,
      f?.dir ?? null,
      f ? easeTurnWeighted(f.t) : 0
    )
    return { role, thetaL, thetaR, beta: thetaL - thetaR }
  }

  // Static uv tables: riders sample their sprite cell (+flip), struts the
  // swatch cell 16, the tab its 2-cell handle — all remapped into the
  // book atlas rect when INFRA-1 packs this art.
  const riderGeometry = useMemo(() => {
    const uv = new Float32Array(n * 4 * 2)
    layer.struts.forEach((s, i) => {
      cellUvs(s.sprite, 1, s.flip).forEach(([u, v], c) => uv.set([u, v], (i * 4 + c) * 2))
    })
    return makeMergedQuads(n, applyUvRect(uv, rect))
  }, [layer.struts, n, rect])
  const strutGeometry = useMemo(() => {
    const uv = new Float32Array(n * 4 * 2)
    for (let i = 0; i < n; i++) {
      cellUvs(16, 1, false).forEach(([u, v], c) => uv.set([u, v], (i * 4 + c) * 2))
    }
    return makeMergedQuads(n, applyUvRect(uv, rect))
  }, [n, layer.struts, rect])
  const tabGeometry = useMemo(() => {
    // The STIR tab reads the atlas's 2x2 region (cells 17-18 + 25-26): banner
    // lettering over the bee-on-honey-drop pull.
    const uv = new Float32Array(4 * 2)
    cellUvs(17, 2, false, 2).forEach(([u, v], c) => uv.set([u, v], c * 2))
    return makeMergedQuads(1, applyUvRect(uv, rect))
  }, [rect])
  // Coarse/foreshortened-pointer slop pad, invisible: the tab die-cut itself
  // is a 55x22px sliver at the reading camera (handle-hit.ts).
  const slopGeometry = useMemo(() => makeMergedQuads(1, new Float32Array(8)), [])

  const paperTexture = sharedPaperTexture()
  const riderMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffffff', transparent: true, alphaTest: 0.1 }),
    []
  )
  // Hairline struts: sky-tinted flats (near-invisible against the painted sky
  // — the daisy-field trick). Unpainted they stay the flat hex, no alpha.
  const strutMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#a9bccb' }),
    []
  )
  const tabMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffffff', transparent: true, alphaTest: 0.1 }),
    []
  )

  useEffect(() => {
    riderMaterial.map = atlasArt ?? paperTexture
    riderMaterial.transparent = !!atlasArt
    riderMaterial.alphaTest = atlasArt ? 0.1 : 0
    riderMaterial.color.set(atlasArt ? '#ffffff' : tint.lit)
    riderMaterial.needsUpdate = true
    strutMaterial.map = atlasArt
    strutMaterial.color.set(atlasArt ? '#ffffff' : '#a9bccb')
    strutMaterial.needsUpdate = true
    tabMaterial.map = atlasArt ?? paperTexture
    tabMaterial.transparent = !!atlasArt
    tabMaterial.alphaTest = atlasArt ? 0.1 : 0
    tabMaterial.color.set(atlasArt ? '#ffffff' : tint.shade)
    tabMaterial.needsUpdate = true
    if (atlasArt) {
      atlasArt.wrapS = THREE.ClampToEdgeWrapping
      atlasArt.wrapT = THREE.ClampToEdgeWrapping
    }
  }, [atlasArt, paperTexture, riderMaterial, strutMaterial, tabMaterial, tint])

  useEffect(
    () => () => {
      riderGeometry.dispose()
      strutGeometry.dispose()
      tabGeometry.dispose()
      slopGeometry.dispose()
    },
    [riderGeometry, strutGeometry, tabGeometry, slopGeometry]
  )
  useEffect(
    () => () => {
      riderMaterial.dispose()
      strutMaterial.dispose()
      tabMaterial.dispose()
    },
    [riderMaterial, strutMaterial, tabMaterial]
  )

  // --- STIR grab (tabpiece idiom: H2 scrub channel, H3 release, H6 slop) ---
  const restAnglesNow = () => {
    const { thetaL, thetaR } = readAngles()
    return { thetaL, thetaR }
  }
  const projectPointerD = (e: ThreeEvent<PointerEvent>, thetaR: number): number | null =>
    projectPageD(pointerLocalRay(e), thetaR)

  const releaseGrab = (e: ThreeEvent<PointerEvent>): void => {
    if (!grabRef.current) return
    grabRef.current = null
    tap.end(stirChannel) // a press that never drew the tab answers with a nudge
    endGrabChannel(layer.id)
    useStorybookStore.getState().endGrab()
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      // capture already gone — nothing to release
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (grabRef.current) return
    if (!acceptsHandleHit(e, slopRef.current)) return
    const st = useStorybookStore.getState()
    if (!st.booted || st.turning !== null || st.spread !== spreadIndex) return
    const { thetaR } = restAnglesNow()
    const dGrab = projectPointerD(e, thetaR)
    if (dGrab === null) return
    const sStart = clamp(readUserDrive(stirChannel) ?? stirRef.current, 0, layer.stir.stroke)
    st.beginGrab(layer.id, 'tab')
    if (useStorybookStore.getState().grab?.id !== layer.id) return
    grabRef.current = { sGrabStart: sStart, dGrab }
    writeUserDrive(stirChannel, sStart, [0, layer.stir.stroke])
    tap.begin(sStart)
    beginGrabChannel(layer.id)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>): void => {
    const grab = grabRef.current
    if (!grab) return
    if (useStorybookStore.getState().grab?.id !== layer.id) {
      releaseGrab(e)
      return
    }
    const { thetaR } = restAnglesNow()
    const dNow = projectPointerD(e, thetaR)
    if (dNow === null) return
    const sUser = clamp(grab.sGrabStart + (dNow - grab.dGrab), 0, layer.stir.stroke)
    writeUserDrive(stirChannel, sUser, [0, layer.stir.stroke])
    tap.track(sUser, TAP_EPS)
    e.stopPropagation()
  }

  const onPointerOver = (): void => {
    const st = useStorybookStore.getState()
    if (st.grab === null && st.booted && st.turning === null && st.spread === spreadIndex) {
      gl.domElement.style.cursor = 'grab'
      st.setHover(layer.id)
    }
  }
  const onPointerOut = (): void => {
    const st = useStorybookStore.getState()
    if (!grabRef.current && st.grab === null) gl.domElement.style.cursor = ''
    st.clearHover(layer.id)
  }

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const { role, thetaL, thetaR, beta } = readAngles()
    const visible = role !== 'hidden' && beta > FLAT_EPSILON
    group.visible = visible
    if (!visible) return

    // Stir stroke: the channel while grabbed; overdamped decay to 0 on release
    // (~300 ms). Dev override (?sbdrive=<id>~stir:<s>) freezes it for captures.
    const override = readDriveOverride(stirChannel)
    const channel = readUserDrive(stirChannel)
    let s: number
    if (override !== null) {
      s = clamp(override, 0, layer.stir.stroke)
    } else if (grabRef.current && channel !== undefined) {
      s = channel
    } else {
      s = (channel ?? stirRef.current) * Math.exp(-delta / RELEASE_TAU)
      if (s < RELEASE_EPS) s = 0
      if (channel !== undefined) {
        if (s === 0) clearUserDrive(stirChannel)
        else writeUserDrive(stirChannel, s, [0, layer.stir.stroke])
      }
    }
    stirRef.current = s

    // Tap answer (BW-18): the tab creeps out and the ripple starts running up
    // the arm — render-time only, never written to the stir channel, so the
    // release decay above owns the reader's own stroke unchanged.
    const shownS = clamp(
      s + nudgeOffset(stirChannel, s, 0, layer.stir.stroke, NUDGE_SPAN_STROKE_FRAC * layer.stir.stroke),
      0,
      layer.stir.stroke
    )
    const poses = solveSwarmArcPose(layer, thetaL, thetaR, shownS)
    const strutArr = (strutGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const riderArr = (riderGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    poses.forEach((pose, i) => {
      writeQuadAt(strutArr, i, pose.strut)
      writeQuadAt(riderArr, i, pose.rider)
    })
    ;(strutGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(riderGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    strutGeometry.computeBoundingSphere()
    riderGeometry.computeBoundingSphere()

    // The tab rides the right page plane at the fore edge and slides out by
    // exactly the stroke (Birmingham 84 pull-strip grammar) — one shared quad
    // helper (popup-swarmarc.ts) so the bench can aim at the handle the reader
    // sees. It fades shut with the envelope like everything else.
    const tabQuad = swarmStirTabQuad(layer, shownS, thetaL, thetaR)
    const tabArr = (tabGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    writeQuadAt(tabArr, 0, tabQuad)
    const slopArr = (slopGeometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    writeQuadAt(slopArr, 0, enlargeQuad(tabQuad, HANDLE_SLOP_FLAT))
    ;(slopGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    slopGeometry.computeBoundingSphere()
    ;(tabGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    tabGeometry.computeBoundingSphere()
  })

  return (
    <group ref={groupRef} name={`swarmarc-${layer.id}`} visible={false}>
      <mesh geometry={strutGeometry} material={strutMaterial} renderOrder={0} />
      <mesh geometry={riderGeometry} material={riderMaterial} renderOrder={0} />
      <group
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseGrab}
        onPointerCancel={releaseGrab}
        onLostPointerCapture={releaseGrab}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <mesh ref={tabRef} geometry={tabGeometry} material={tabMaterial} renderOrder={1} />
        <mesh ref={slopRef} geometry={slopGeometry} material={sharedHandleMaterial()} renderOrder={2} />
      </group>
    </group>
  )
}
