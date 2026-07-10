import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// The 3D layer needs a WebGL context jsdom can't provide. Swap the shared
// canvas and the two hero objects for inert nodes that surface the props
// SaveStage forwards, so these tests assert host wiring — not GL behavior
// (the card/character internals are exercised visually in R3).
vi.mock('@/components/labs/memory-card/three/stage', () => ({
  VignetteCanvas: ({
    children,
    envIntensity,
    shadowRadius,
    fallbackGlyph,
    reduced,
  }: {
    children: ReactNode
    envIntensity?: number
    shadowRadius?: number
    fallbackGlyph?: string
    reduced?: boolean
  }) => (
    <div
      data-testid="vignette-canvas"
      data-env-intensity={String(envIntensity)}
      data-shadow-radius={String(shadowRadius)}
      data-fallback-glyph={String(fallbackGlyph)}
      data-reduced={String(reduced)}
    >
      {children}
    </div>
  ),
}))

vi.mock('@/components/labs/memory-card/three/gltf-vignette', () => ({
  GltfVignette: ({ src, animation }: { src: string; animation?: string }) => (
    <div data-testid="gltf-vignette" data-src={src} data-animation={animation} />
  ),
}))

vi.mock('@/components/labs/memory-card/three/save-card', () => ({
  SaveCard: ({
    save,
    flipped,
    reduced,
    onTap,
  }: {
    save: { kind: string }
    flipped: boolean
    reduced: boolean
    onTap?: () => void
  }) => (
    <button
      type="button"
      data-testid="save-card"
      data-kind={save.kind}
      data-flipped={String(flipped)}
      data-reduced={String(reduced)}
      onClick={() => onTap?.()}
    />
  ),
}))

import { CHARACTER_IDLE_CLIP, SaveStage } from '@/components/labs/memory-card/three/save-stage'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)
const projectSave = saves.find((s) => s.kind === 'project')!
const bioSave = saves.find((s) => s.kind === 'bio')!
const stackSave = saves.find((s) => s.kind === 'stack')!
const contactSave = saves.find((s) => s.kind === 'contact')!

describe('SaveStage', () => {
  it('renders standalone without any provider wrapper', () => {
    render(<SaveStage save={projectSave} flipped={false} reduced={false} />)
    expect(screen.getByTestId('vignette-canvas')).toBeInTheDocument()
  })

  it('mounts the character GLB for the bio slot, never the card', () => {
    render(<SaveStage save={bioSave} flipped={false} reduced={false} />)
    const character = screen.getByTestId('gltf-vignette')
    expect(character).toHaveAttribute('data-src', '/labs/memory-card/models/character.glb')
    expect(character).toHaveAttribute('data-animation', CHARACTER_IDLE_CLIP)
    expect(screen.queryByTestId('save-card')).toBeNull()
  })

  it('mounts the card (never the character) for a project slot', () => {
    render(<SaveStage save={projectSave} flipped={false} reduced={false} />)
    expect(screen.getByTestId('save-card')).toHaveAttribute('data-kind', 'project')
    expect(screen.queryByTestId('gltf-vignette')).toBeNull()
  })

  it('mounts the card for the stack and contact slots too', () => {
    const { rerender } = render(
      <SaveStage save={stackSave} flipped={false} reduced={false} />
    )
    expect(screen.getByTestId('save-card')).toHaveAttribute('data-kind', 'stack')

    rerender(<SaveStage save={contactSave} flipped={false} reduced={false} />)
    expect(screen.getByTestId('save-card')).toHaveAttribute('data-kind', 'contact')
  })

  it('forwards the flipped prop to the card', () => {
    const { rerender } = render(
      <SaveStage save={projectSave} flipped={false} reduced={false} />
    )
    expect(screen.getByTestId('save-card')).toHaveAttribute('data-flipped', 'false')

    rerender(<SaveStage save={projectSave} flipped reduced={false} />)
    expect(screen.getByTestId('save-card')).toHaveAttribute('data-flipped', 'true')
  })

  it('fires onTap when the card is tapped', () => {
    const onTap = vi.fn()
    render(<SaveStage save={projectSave} flipped={false} reduced={false} onTap={onTap} />)
    fireEvent.click(screen.getByTestId('save-card'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('lights the card kinds dim and the character bright, each with its own shadow pool', () => {
    const { rerender } = render(
      <SaveStage save={projectSave} flipped={false} reduced={false} />
    )
    const cardCanvas = screen.getByTestId('vignette-canvas')
    expect(cardCanvas).toHaveAttribute('data-env-intensity', '0.35')
    expect(cardCanvas).toHaveAttribute('data-shadow-radius', '0.001')

    rerender(<SaveStage save={bioSave} flipped={false} reduced={false} />)
    const bioCanvas = screen.getByTestId('vignette-canvas')
    expect(bioCanvas).toHaveAttribute('data-env-intensity', '1.15')
    expect(bioCanvas).toHaveAttribute('data-shadow-radius', '1.5')
  })

  it('passes the slot accent through as the fallback glyph name', () => {
    // slot 01 is the first project → triangle accent → triangle fallback glyph.
    render(<SaveStage save={projectSave} flipped={false} reduced={false} />)
    expect(screen.getByTestId('vignette-canvas')).toHaveAttribute(
      'data-fallback-glyph',
      'triangle'
    )
  })

  it('keeps the character idle clip identity-agnostic (character-agnostic law)', () => {
    expect(CHARACTER_IDLE_CLIP).not.toMatch(/\b(she|her|hers|woman|female|girl)\b/i)
  })
})
