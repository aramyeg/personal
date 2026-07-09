'use client'

/**
 * TEMPORARY look-dev harness for the Memory Card hero objects (Task 5 → GATE 0).
 * Deleted in Task 11 — no GalleryChrome, no routing polish. `?item=` isolates
 * one object; default shows all three side by side on the ink background so the
 * studio rig can be judged object-to-object.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MC, accentFor, type GlyphName } from '@/components/labs/memory-card/tokens'
import { VignetteCanvas } from '@/components/labs/memory-card/three/stage'
import { VoxelCharacter } from '@/components/labs/memory-card/three/voxel-character'
import { CardModel, type CardLabel } from '@/components/labs/memory-card/three/card-model'
import { CRTModel } from '@/components/labs/memory-card/three/crt-model'
import { projects } from '@/data/projects'

type CameraSpec = { position: [number, number, number]; fov: number }

const featured = projects[0]
const CARD_LABEL: CardLabel = {
  title: featured.title,
  company: featured.company,
  year: featured.year,
  slot: '01',
  accent: accentFor(0),
}
const CRT_LINES = ['LOADING BIO...', '8 YRS FINTECH', 'YEREVAN / WORLDWIDE', 'PRESS START']

const CAM: Record<'character' | 'card' | 'crt', {
  camera: CameraSpec
  target: [number, number, number]
  shadowRadius: number
  glyph: GlyphName
}> = {
  character: {
    camera: { position: [0.4, 1.7, 6.2], fov: 30 },
    target: [0, 1.35, 0],
    shadowRadius: 2.3,
    glyph: 'triangle',
  },
  card: {
    camera: { position: [0.2, 1.6, 5.4], fov: 28 },
    target: [0, 1.42, 0],
    shadowRadius: 1.5,
    glyph: 'circle',
  },
  crt: {
    camera: { position: [0.3, 1.7, 6.0], fov: 32 },
    target: [0, 1.4, 0],
    shadowRadius: 2.1,
    glyph: 'cross',
  },
}

function StageColumn({
  name,
  children,
}: {
  name: 'character' | 'card' | 'crt'
  children: React.ReactNode
}) {
  const cfg = CAM[name]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 320 }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(233,231,224,0.5)',
          textAlign: 'center',
        }}
      >
        {name}
      </div>
      <div style={{ height: 520 }}>
        <VignetteCanvas
          height="520px"
          camera={cfg.camera}
          target={cfg.target}
          shadowRadius={cfg.shadowRadius}
          fallbackGlyph={cfg.glyph}
        >
          {children}
        </VignetteCanvas>
      </div>
    </div>
  )
}

function models(): Record<'character' | 'card' | 'crt', React.ReactNode> {
  return {
    character: <VoxelCharacter spin />,
    card: <CardModel label={CARD_LABEL} tilt={{ x: -0.05, y: -0.5 }} backLines={featured.metrics} />,
    crt: <CRTModel lines={CRT_LINES} />,
  }
}

function LookDev() {
  const params = useSearchParams()
  const item = (params.get('item') ?? 'all') as 'character' | 'card' | 'crt' | 'all'
  const m = models()
  const names: ('character' | 'card' | 'crt')[] =
    item === 'all' ? ['character', 'card', 'crt'] : [item]

  return (
    <main
      style={{
        minHeight: '100vh',
        background: MC.ink,
        color: MC.paper,
        padding: '48px 32px',
        display: 'flex',
        gap: 32,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {names.map((n) => (
        <StageColumn key={n} name={n}>
          {m[n]}
        </StageColumn>
      ))}
    </main>
  )
}

export default function LookDevPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: MC.ink }} />}>
      <LookDev />
    </Suspense>
  )
}
