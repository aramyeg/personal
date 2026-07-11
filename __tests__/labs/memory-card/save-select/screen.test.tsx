import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/font/google is unavailable under vitest — stub with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// A fake audio instance so audio-context builds without WebAudio.
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => ({
    resume: vi.fn(),
    blip: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    boot: vi.fn(() => false),
    setRoomTone: vi.fn(),
    setEnabled: vi.fn(),
    enabled: vi.fn(() => false),
    dispose: vi.fn(),
  }),
}))

// The 3D layer needs a WebGL context jsdom can't provide. Swap the shared canvas
// and the two scene components for inert nodes so these tests exercise the
// screen's own DOM (index + story band), not GL behaviour.
vi.mock('@/components/labs/memory-card/three/stage', () => ({
  VignetteCanvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="vignette-canvas">{children}</div>
  ),
}))
vi.mock('@/components/labs/memory-card/three/figure-stage', () => ({
  FigureSceneContents: ({ accent, equip }: { accent: string; equip: boolean }) => (
    <div data-testid="figure" data-accent={accent} data-equip={String(equip)} />
  ),
}))
vi.mock('@/components/labs/memory-card/three/card-arc', () => ({
  CardArc: ({ focusIndex, variant }: { focusIndex: number; variant: string }) => (
    <div data-testid="card-arc" data-focus={String(focusIndex)} data-variant={variant} />
  ),
}))

import { SaveSelectScreen } from '@/components/labs/memory-card/save-select/screen'
import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

describe('SaveSelectScreen', () => {
  it('renders the six saves as a keyboard-navigable index listbox', () => {
    render(<SaveSelectScreen />)
    const list = screen.getByRole('list', { name: /save files/i })
    for (const save of saves) {
      expect(
        within(list).getByRole('button', { name: new RegExp(`slot ${save.slot}`, 'i') })
      ).toBeInTheDocument()
    }
  })

  it('mounts the figure and card-arc canvases', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByTestId('figure')).toBeInTheDocument()
    expect(screen.getByTestId('card-arc')).toBeInTheDocument()
  })

  it('tells the default active save story (slot 01) with a LOAD control naming it', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByRole('heading', { name: /amio bank ibank/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load slot 01/i })).toHaveAccessibleName(
      /amio bank ibank/i
    )
  })

  it('equips the figure only on the first save and passes its accent', () => {
    render(<SaveSelectScreen />)
    const figure = screen.getByTestId('figure')
    expect(figure).toHaveAttribute('data-equip', 'true')
    expect(figure).toHaveAttribute('data-accent', saves[0].accent)
  })

  it('forwards the composition variant to the card arc', () => {
    render(<SaveSelectScreen variant="b" />)
    expect(screen.getByTestId('card-arc')).toHaveAttribute('data-variant', 'b')
  })

  it('never renders a lead title anywhere on the screen (claims law)', () => {
    const { container } = render(<SaveSelectScreen />)
    expect(container.textContent).not.toMatch(/lead/i)
  })

  it('produces byte-identical first-paint markup in both reduced modes (hydration law)', () => {
    const unreduced = renderToStaticMarkup(<SaveSelectScreen reduced={false} />)
    const reduced = renderToStaticMarkup(<SaveSelectScreen reduced />)
    expect(reduced).toBe(unreduced)
  })
})

describe('MemoryCardChrome footer (license law)', () => {
  it('keeps both CC-BY attribution lines always visible', () => {
    render(<MemoryCardChrome />)
    expect(screen.getByText(/crt model by meipal \(cc by 4\.0\)/i)).toBeInTheDocument()
    expect(
      screen.getByText(/character by humans of the world \(cc by 4\.0\)/i)
    ).toBeInTheDocument()
  })
})
