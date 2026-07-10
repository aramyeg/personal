import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/font/google is unavailable under vitest — stub with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// A fake audio instance so audio-context builds without WebAudio; every action
// is a no-op the screen never asserts against.
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

// The 3D stage needs a WebGL context jsdom can't provide. Swap it for an inert
// node that surfaces only the highlighted save's kind — deliberately ignoring
// `reduced`/`flipped` so the hydration parity check exercises the screen's own
// markup (the real SaveStage markup is reduced-independent too).
vi.mock('@/components/labs/memory-card/three/save-stage', () => ({
  SaveStage: ({ save }: { save: { kind: string } }) => (
    <div data-testid="save-stage" data-kind={save.kind} />
  ),
}))

import { SaveSelectScreen } from '@/components/labs/memory-card/save-select/screen'
import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

describe('SaveSelectScreen', () => {
  it('renders the SELECT FILE display header exactly once, set in Anton', () => {
    render(<SaveSelectScreen />)
    const heading = screen.getByRole('heading', { name: /select file/i })
    expect(heading.style.fontFamily).toContain('Anton')
    expect(screen.getAllByRole('heading', { name: /select file/i })).toHaveLength(1)
  })

  it('never renders a lead title anywhere on the screen (claims law)', () => {
    const { container } = render(<SaveSelectScreen />)
    expect(container.textContent).not.toMatch(/lead/i)
  })

  it('renders all six strips plus the single-object stage', () => {
    render(<SaveSelectScreen />)
    for (const save of saves) {
      expect(screen.getByText(save.slot)).toBeInTheDocument()
    }
    expect(screen.getByTestId('save-stage')).toBeInTheDocument()
  })

  it('shows the blocks-used stat and a LOAD control naming the active save', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByText(/blocks 9\/15 used/i)).toBeInTheDocument()
    // Default active slot is 01 → AMIO Bank iBank; the LOAD control names it.
    const load = screen.getByRole('button', { name: /load slot 01/i })
    expect(load).toHaveAccessibleName(/amio bank ibank/i)
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

  it('no longer renders the removed section anchors', () => {
    render(<MemoryCardChrome />)
    for (const label of ['work', 'skills', 'about']) {
      expect(screen.queryByRole('link', { name: label })).toBeNull()
    }
  })
})
