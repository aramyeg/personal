import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// The screen routes loads through the App Router; mock it so useRouter resolves
// under vitest and the load URL is observable.
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  usePathname: () => '/labs/memory-card',
}))

// next/font/google is unavailable under vitest — stub with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// A fake audio instance so audio-context builds without WebAudio. Screen is
// rendered without a MemoryCardAudioProvider below (isolating the screen's
// own DOM from audio wiring, which sections.test.tsx covers separately), so
// this mock is inert today — kept in the real PS1Audio shape anyway so it
// doesn't silently drift if a future test wraps the screen in the provider.
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => ({
    resume: vi.fn(),
    blip: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    bootMusic: vi.fn(() => false),
    stopBoot: vi.fn(),
    setRoomTone: vi.fn(),
    setEnabled: vi.fn(),
    enabled: vi.fn(() => false),
    dispose: vi.fn(),
  }),
}))

// The 3D layer needs a WebGL context jsdom can't provide. Swap the shared canvas
// and the two scene components for inert nodes so these tests exercise the
// screen's own DOM (the slot index + its expanded active card), not GL behaviour.
vi.mock('@/components/labs/memory-card/three/stage', () => ({
  VignetteCanvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="vignette-canvas">{children}</div>
  ),
}))
vi.mock('@/components/labs/memory-card/three/figure-stage', () => ({
  FigureSceneContents: ({ accent, fit }: { accent: string; fit: number }) => (
    <div data-testid="figure" data-accent={accent} data-fit={String(fit)} />
  ),
}))

import { SaveSelectScreen } from '@/components/labs/memory-card/save-select/screen'
import { MemoryCardFooter } from '@/components/labs/memory-card/sections/chrome'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

describe('SaveSelectScreen', () => {
  beforeEach(() => push.mockClear())

  it('routes to the save panel when the active card LOAD button fires', () => {
    render(<SaveSelectScreen />)
    fireEvent.click(screen.getByRole('button', { name: /load slot 01/i }))
    expect(push).toHaveBeenCalledWith('/labs/memory-card/save/amio-bank')
  })

  it('routes to the save panel when the rail activates a project save (Enter)', () => {
    render(<SaveSelectScreen />)
    fireEvent.keyDown(screen.getByRole('list', { name: /save files/i }), { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/labs/memory-card/save/amio-bank')
  })

  it('opens a system dialog (never routes) when a system save is activated', () => {
    render(<SaveSelectScreen />)
    // Slot 04 is the first system save (system data / bio). Anchor to the rail
    // row so the expanded card's "load slot 04" button doesn't also match. First
    // click highlights it, second activates it → the dialog opens over the
    // still-mounted screen; nothing routes (system saves have no project).
    const railRow = () => screen.getByRole('button', { name: /^slot 04/i })
    fireEvent.click(railRow())
    fireEvent.click(railRow())
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /system data/i })).toBeInTheDocument()
  })

  it('closes the system dialog when its close control fires', () => {
    render(<SaveSelectScreen />)
    const railRow = () => screen.getByRole('button', { name: /^slot 04/i })
    fireEvent.click(railRow())
    fireEvent.click(railRow())
    expect(screen.getByRole('dialog', { name: /system data/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the three system dialogs in the server markup for crawlers (hidden when closed)', () => {
    const html = renderToStaticMarkup(<SaveSelectScreen />)
    // Bio, written-with, and contact content is present but inside hidden
    // wrappers on first paint, so it ships in the SSR HTML.
    expect(html).toContain('hidden')
    // Raw SSR markup escapes apostrophes (I&#x27;ve), so assert an apostrophe-free
    // slice of the verbatim bio.
    expect(html).toContain('For the last eight years')
    expect(html).toContain('the component tree behind every section')
    expect(html).toContain('save your progress')
  })

  it('renders the six saves as a keyboard-navigable index listbox', () => {
    render(<SaveSelectScreen />)
    const list = screen.getByRole('list', { name: /save files/i })
    for (const save of saves) {
      // Anchored so the active card's "load slot 01" button doesn't also match.
      expect(
        within(list).getByRole('button', { name: new RegExp(`^slot ${save.slot}`, 'i') })
      ).toBeInTheDocument()
    }
  })

  it('mounts the single figure canvas (the card fan and its scene are gone)', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByTestId('figure')).toBeInTheDocument()
    expect(screen.queryByTestId('card-arc')).toBeNull()
  })

  it('tells the default active save story (slot 01): a display title + a LOAD control naming it', () => {
    render(<SaveSelectScreen />)
    // The big Anton display title is the screen's <h1>.
    expect(
      screen.getByRole('heading', { level: 1, name: /amio bank ibank/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load slot 01/i })).toHaveAccessibleName(
      /amio bank ibank/i
    )
  })

  it('renders the AMIO product name in true casing — iBank, never IBANK (casing law)', () => {
    render(<SaveSelectScreen />)
    // The transform-free title keeps the product name intact in the DOM text.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AMIO Bank iBank')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('iBank')
  })

  it('passes the active save accent to the figure', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByTestId('figure')).toHaveAttribute('data-accent', saves[0].accent)
  })

  it('dresses the figure in the active save fit and re-dresses it on highlight', () => {
    render(<SaveSelectScreen />)
    expect(screen.getByTestId('figure')).toHaveAttribute('data-fit', String(saves[0].fit))
    // One click on a non-active row highlights it — the figure re-dresses into
    // that save's fit without loading anything.
    fireEvent.click(screen.getByRole('button', { name: /^slot 03/i }))
    expect(screen.getByTestId('figure')).toHaveAttribute('data-fit', String(saves[2].fit))
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

describe('MemoryCardFooter (license law)', () => {
  it('keeps both asset attribution lines always visible', () => {
    render(<MemoryCardFooter />)
    expect(screen.getByText(/crt model by meipal \(cc by 4\.0\)/i)).toBeInTheDocument()
    expect(
      screen.getByText(/character base by quaternius \(cc0\)/i)
    ).toBeInTheDocument()
  })
})
