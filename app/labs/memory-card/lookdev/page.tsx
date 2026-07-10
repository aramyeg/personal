'use client'

/**
 * TEMPORARY look-dev harness for the Memory Card hero objects (Task 5 → GATE 0).
 * Deleted in Task 11 — no GalleryChrome, no routing polish. `?item=` isolates
 * one object; default shows all three side by side on the ink background so the
 * studio rig can be judged object-to-object.
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MC, type GlyphName } from '@/components/labs/memory-card/tokens'
import { VignetteCanvas } from '@/components/labs/memory-card/three/stage'
import { GltfVignette } from '@/components/labs/memory-card/three/gltf-vignette'

type CameraSpec = { position: [number, number, number]; fov: number }

const CAM: Record<'character' | 'card' | 'crt', {
  camera: CameraSpec
  target: [number, number, number]
  shadowRadius: number
  glyph: GlyphName
  yaw: number
  envIntensity: number
}> = {
  character: {
    camera: { position: [0.4, 1.75, 6.3], fov: 30 },
    target: [0, 1.4, 0],
    shadowRadius: 2.3,
    glyph: 'triangle',
    yaw: 0.7,
    envIntensity: 1.15,
  },
  card: {
    camera: { position: [0.25, 1.5, 6.8], fov: 25 },
    target: [0, 1.42, 0],
    shadowRadius: 1.5,
    glyph: 'circle',
    yaw: 2.8,
    envIntensity: 0.35,
  },
  crt: {
    camera: { position: [0.35, 1.72, 6.4], fov: 32 },
    target: [0, 1.5, 0],
    shadowRadius: 2.2,
    glyph: 'cross',
    yaw: -1.0,
    envIntensity: 0.7,
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
          envIntensity={cfg.envIntensity}
        >
          {children}
        </VignetteCanvas>
      </div>
    </div>
  )
}

function models(): Record<'character' | 'card' | 'crt', React.ReactNode> {
  return {
    character: (
      <GltfVignette
        src="/labs/memory-card/models/character.glb"
        fitHeight={2.6}
        yaw={CAM.character.yaw}
      />
    ),
    card: (
      <GltfVignette
        src="/labs/memory-card/models/memory-card.glb"
        fitHeight={1.9}
        yaw={CAM.card.yaw}
      />
    ),
    crt: (
      <GltfVignette src="/labs/memory-card/models/crt.glb" fitHeight={2.1} yaw={CAM.crt.yaw} />
    ),
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
