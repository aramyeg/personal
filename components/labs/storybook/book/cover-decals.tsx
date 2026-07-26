'use client'

/**
 * Batch-1 art dressing for the closed front cover: a central crest
 * medallion, four mirrored corner flourishes, and a stamped title/subtitle
 * banner (task 19). Mounted as a sibling of the cover's leather box inside
 * book.tsx's front-cover pivot group, so every decal moves WITH the cover
 * through the whole open/close turn — no separate animation wiring needed,
 * it inherits the pivot's rotation.z exactly like the box mesh does.
 *
 * Coordinate convention (matches the box mesh in book.tsx): this component
 * lives inside the pivot group, so x∈[0,coverW] runs spine→free edge and
 * z∈[-coverH/2,coverH/2] runs far(top of screen)→near(bottom, toward the
 * candle) — see book.tsx's file header for the world-axis derivation. Every
 * decal is a flat plane rotated -90° about X so its face points along local
 * +Y (the box's outer face when closed), lifted a hair above the leather
 * (DECAL_LIFT) to avoid z-fighting.
 *
 * Crest/corner art loads through useArtTexture (use-layer-texture.ts's
 * shared loader, no placeholder fallback): missing art simply means no
 * decal, cover stays bare leather. The title banner is a separate
 * canvas-textured plane instead of being baked into makeLeatherCanvas —
 * makeLeatherCanvas is synchronous and procedural, and stamping real text
 * onto it would mean threading an async `document.fonts.ready` wait through
 * that texture factory; a standalone plane drawn once fonts resolve is the
 * documented escape hatch (task-19 brief) and keeps makeLeatherCanvas
 * untouched.
 */

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { createCanvas } from '../procedural/canvas-utils'
import { BOOK_SUBTITLE, BOOK_TITLE } from '../content'
import { useGuardedDispose } from './material-pool'
import { BOOK, makeCanvasTexture } from './book'
import { plyLift } from './lift-ladder'
import { useArtTexture } from './use-layer-texture'

// Real baked-art aspect ratios (width/height) for the two Batch-1 cover
// assets — see .superpowers/sdd/task-19-report.md. Both are trimmed,
// non-square cutouts, so the plane geometry must match this ratio or the
// medallion/flourish reads squashed.
const CREST_ASPECT = 798 / 781
const CORNER_ASPECT = 856 / 814

// All BOOK.coverW/coverH-scaled numbers below are kept as fractions and
// multiplied out inside function bodies rather than at module scope: this
// file and book.tsx import each other (book.tsx renders <CoverDecals>,
// this file reads BOOK/makeCanvasTexture back from book.tsx — the same
// cyclic-import shape popup-spread.tsx/use-layer-texture.ts already use
// safely), and a top-level `const X = BOOK.coverW * f` would evaluate
// before book.tsx's own `export const BOOK` initializer has run, throwing
// "Cannot access 'BOOK' before initialization".
const CREST_WIDTH_FRAC = 0.46 // fraction of BOOK.coverW
const CORNER_WIDTH_FRAC = 0.22
const CORNER_MARGIN_X_FRAC = 0.075 // fraction of BOOK.coverW
const CORNER_MARGIN_Z_FRAC = 0.07 // fraction of BOOK.coverH
// Center-low per the poster reference (scripts/posters/storybook-poster.html):
// the crest sits a little below true vertical center, clear of the title.
const CREST_Z_FRAC = 0.16 // fraction of BOOK.coverH
// Glue-stack class: one ply (lift-ladder.ts).
export const DECAL_LIFT = plyLift(1)
const DECAL_ROTATION: readonly [number, number, number] = [-Math.PI / 2, 0, 0]

// --------------------------------------------------------------- corners --

type Corner = 'tl' | 'tr' | 'bl' | 'br'
const CORNER_ORDER: readonly Corner[] = ['tl', 'tr', 'bl', 'br']

/**
 * The baked corner art's elbow sits at its own bottom-left (vertical arm up
 * the left edge, horizontal arm along the bottom — confirmed by eye against
 * the source webp), which lands at the book's bottom-left corner unmirrored
 * once the -90°-about-X rotation maps local +X→world +X and local
 * +Y(image-top)→world -Z (see file header). Each of the other three corners
 * is a mirror of that base case: `scaleX` flips spine-side↔free-edge,
 * `scaleY` (pre-rotation, so it flips the resulting world Z) flips
 * far(top)↔near(bottom).
 */
function cornerTransform(
  corner: Corner,
  width: number,
  height: number
): { x: number; z: number; scale: readonly [number, number, number] } {
  const marginX = BOOK.coverW * CORNER_MARGIN_X_FRAC
  const marginZ = BOOK.coverH * CORNER_MARGIN_Z_FRAC
  const mirrorX = corner === 'tr' || corner === 'br'
  const mirrorY = corner === 'tl' || corner === 'tr'
  const x = mirrorX ? BOOK.coverW - marginX - width / 2 : marginX + width / 2
  const z = mirrorY
    ? -BOOK.coverH / 2 + marginZ + height / 2
    : BOOK.coverH / 2 - marginZ - height / 2
  return { x, z, scale: [mirrorX ? -1 : 1, mirrorY ? -1 : 1, 1] }
}

function makeDecalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    roughness: 0.55,
  })
}

/** Crest medallion (centered) + four mirrored corner flourishes. Each art
 *  id loads once and is shared across every mesh that uses it (one corner
 *  texture, four positioned/mirrored meshes) rather than re-requesting the
 *  same file four times. */
function CrestAndCorners({ coverTopY }: { coverTopY: number }) {
  const crestTexture = useArtTexture('cover-crest')
  const cornerTexture = useArtTexture('cover-corner')

  const crestWidth = BOOK.coverW * CREST_WIDTH_FRAC
  const crestHeight = crestWidth / CREST_ASPECT
  const cornerWidth = BOOK.coverW * CORNER_WIDTH_FRAC
  const cornerHeight = cornerWidth / CORNER_ASPECT

  const crestGeometry = useMemo(
    () => new THREE.PlaneGeometry(crestWidth, crestHeight),
    [crestWidth, crestHeight]
  )
  const cornerGeometry = useMemo(
    () => new THREE.PlaneGeometry(cornerWidth, cornerHeight),
    [cornerWidth, cornerHeight]
  )
  const crestMaterial = useMemo(() => makeDecalMaterial(), [])
  const cornerMaterial = useMemo(() => makeDecalMaterial(), [])

  useEffect(() => {
    crestMaterial.map = crestTexture
    crestMaterial.needsUpdate = true
  }, [crestMaterial, crestTexture])

  useEffect(() => {
    cornerMaterial.map = cornerTexture
    cornerMaterial.needsUpdate = true
  }, [cornerMaterial, cornerTexture])

  useGuardedDispose([crestGeometry, cornerGeometry, crestMaterial, cornerMaterial])

  const decalY = coverTopY + DECAL_LIFT
  const crestZ = BOOK.coverH * CREST_Z_FRAC

  return (
    <>
      {crestTexture && (
        <mesh
          geometry={crestGeometry}
          material={crestMaterial}
          position={[BOOK.coverW / 2, decalY, crestZ]}
          rotation={DECAL_ROTATION}
        />
      )}
      {cornerTexture &&
        CORNER_ORDER.map((corner) => {
          const { x, z, scale } = cornerTransform(corner, cornerWidth, cornerHeight)
          return (
            <mesh
              key={corner}
              geometry={cornerGeometry}
              material={cornerMaterial}
              position={[x, decalY, z]}
              rotation={DECAL_ROTATION}
              scale={scale}
            />
          )
        })}
    </>
  )
}

// ----------------------------------------------------------------- title --

const TITLE_CANVAS_W = 1024
const TITLE_CANVAS_H = 620
const TITLE_ASPECT = TITLE_CANVAS_W / TITLE_CANVAS_H
const TITLE_WIDTH_FRAC = 0.62 // fraction of BOOK.coverW
// Upper third of the cover (z spans [-coverH/2, coverH/2]; -coverH/2 is the
// far/top edge as the camera sees it — see book.tsx's file header).
const TITLE_Z_FRAC = 0.29 // fraction of BOOK.coverH, negated at point of use

// Mirrors storybook.css's --sb-gold-bright/--sb-gold-deep/--sb-paper.
// Canvas 2D can't read CSS custom properties without an extra DOM
// round-trip per draw, so the hex literals are duplicated here — same
// tradeoff paper-texture.ts documents for the leather/paper canvases; keep
// the three files in sync if the palette changes.
const GOLD_BRIGHT = '#e6c65a'
const GOLD_PALE = '#f6dd93'
const GOLD_DEEP = '#8f6f1a'
const PAPER = '#e7d5a8'

/** Greedy word-wrap: fills as many words per line as fit `maxWidth`, using
 *  whatever font is already set on `ctx`. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Splits BOOK_TITLE into two roughly-even lines by word count — for the
 *  current title this reproduces the poster reference's manual "A Tale
 *  of" / "Six Kingdoms" break without hardcoding the split point. */
function titleLines(): string[] {
  const words = BOOK_TITLE.split(' ')
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/** Draws the title (two-line, gold gradient over a darker gold shadow copy
 *  for an embossed/stamped feel) and the italic subtitle beneath it. */
function drawTitleCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, TITLE_CANVAS_W, TITLE_CANVAS_H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lines = titleLines()
  const titleSize = 118
  const lineHeight = titleSize * 1.02
  const titleTop = TITLE_CANVAS_H * 0.3
  const cx = TITLE_CANVAS_W / 2

  ctx.font = `700 ${titleSize}px "Grenze Gotisch Variable", serif`
  lines.forEach((line, i) => {
    const y = titleTop + i * lineHeight
    // Darker-gold shadow copy, offset down-right, reads as a pressed/
    // embossed stamp rather than flat ink — same trick as the leather
    // border's double-stroke emboss in paper-texture.ts.
    ctx.fillStyle = GOLD_DEEP
    ctx.fillText(line, cx + 4, y + 5)

    const gradient = ctx.createLinearGradient(0, y - titleSize / 2, 0, y + titleSize / 2)
    gradient.addColorStop(0, GOLD_PALE)
    gradient.addColorStop(0.45, GOLD_BRIGHT)
    gradient.addColorStop(1, GOLD_DEEP)
    ctx.fillStyle = gradient
    ctx.fillText(line, cx, y)
  })

  ctx.font = `italic 500 36px "Alegreya Variable", georgia, serif`
  ctx.fillStyle = PAPER
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
  ctx.shadowBlur = 5
  const subtitleTop = titleTop + lines.length * lineHeight + 44
  const subtitleLineHeight = 44
  wrapLines(ctx, BOOK_SUBTITLE, TITLE_CANVAS_W * 0.88).forEach((line, i) => {
    ctx.fillText(line, cx, subtitleTop + i * subtitleLineHeight)
  })
  ctx.shadowBlur = 0
}

/** Title + subtitle banner, textured from a 2D canvas drawn once the
 *  display/body fonts are ready (falls back to whatever's already loaded
 *  if font loading itself rejects, rather than leaving the banner blank
 *  forever). Renders nothing until that first draw completes. */
function TitleBanner({ coverTopY }: { coverTopY: number }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    let cancelled = false
    let owned: THREE.CanvasTexture | null = null

    const draw = async () => {
      try {
        await Promise.all([
          document.fonts.load('700 118px "Grenze Gotisch Variable"'),
          document.fonts.load('italic 500 36px "Alegreya Variable"'),
        ])
        await document.fonts.ready
      } catch {
        // Font loading can reject in odd environments (offline, blocked
        // font host) — draw with whatever's already available instead of
        // leaving the title stamp blank forever.
      }
      if (cancelled) return
      const { canvas, ctx } = createCanvas(TITLE_CANVAS_W, TITLE_CANVAS_H)
      drawTitleCanvas(ctx)
      const created = makeCanvasTexture(canvas)
      owned = created
      setTexture(created)
    }

    void draw()

    return () => {
      cancelled = true
      owned?.dispose()
      setTexture(null)
    }
  }, [])

  const width = BOOK.coverW * TITLE_WIDTH_FRAC
  const height = width / TITLE_ASPECT
  const geometry = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height])
  const material = useMemo(() => makeDecalMaterial(), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.map = texture
    material.needsUpdate = true
  }, [material, texture])

  if (!texture) return null

  const titleZ = -BOOK.coverH * TITLE_Z_FRAC

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[BOOK.coverW / 2, coverTopY + DECAL_LIFT, titleZ]}
      rotation={DECAL_ROTATION}
    />
  )
}

// --------------------------------------------------------------- exports --

/** All front-cover art dressing. `coverTopY` is the box mesh's own outer
 *  face height (FRONT_LOCAL_Y + BOOK.coverT / 2, computed by book.tsx,
 *  which owns FRONT_LOCAL_Y) — kept a prop rather than re-exported so this
 *  file doesn't need to know how the pivot's rest heights are derived. */
export function CoverDecals({ coverTopY }: { coverTopY: number }) {
  return (
    <>
      <CrestAndCorners coverTopY={coverTopY} />
      <TitleBanner coverTopY={coverTopY} />
    </>
  )
}
