import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// The screen routes loads through the App Router; mock it so useRouter resolves
// under vitest and the load URL is observable.
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
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
  CardArc: ({ focusIndex }: { focusIndex: number }) => (
    <div data-testid="card-arc" data-focus={String(focusIndex)} />
  ),
}))

import { SaveSelectScreen } from '@/components/labs/memory-card/save-select/screen'
import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

describe('SaveSelectScreen', () => {
  beforeEach(() => push.mockClear())

  it('routes to the save panel when the story-band LOAD button fires', () => {
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
    // row so the story-band's "load slot 04" button doesn't also match. First
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
