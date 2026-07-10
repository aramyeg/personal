import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { hallLabs } from '@/lib/labs-manifest'

// A stateful audio double — real enough that toggling actually flips
// `enabled()`, so the provider's optimistic label update can be asserted
// against a real setEnabled(true) call, not just a fixed mock return.
let mockAudioEnabled = false
const mockAudio = {
  resume: vi.fn(),
  blip: vi.fn(),
  select: vi.fn(),
  back: vi.fn(),
  boot: vi.fn(),
  setRoomTone: vi.fn(),
  setEnabled: vi.fn((on: boolean) => {
    mockAudioEnabled = on
  }),
  enabled: vi.fn(() => mockAudioEnabled),
  dispose: vi.fn(),
}
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => mockAudio,
}))

// The lab fonts pull in `next/font/google`, whose call sites are compiled away
// by Next's loader — not available under vitest. These section tests are about
// structure/content, so stub the font module with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// The 3D vignette needs a WebGL context jsdom doesn't provide. Swap the canvas
// and the GLB loader for plain divs so the section renders its real structure.
vi.mock('@/components/labs/memory-card/three/stage', () => ({
  VignetteCanvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="vignette-canvas">{children}</div>
  ),
}))
vi.mock('@/components/labs/memory-card/three/gltf-vignette', () => ({
  GltfVignette: () => <div data-testid="gltf-vignette" />,
}))
// The card rail loads a GLB and runs a WebGL frameloop — neither exists under
// vitest. Swap it for an inert node so WorkSection renders its real HTML.
vi.mock('@/components/labs/memory-card/three/card-rail', () => ({
  CardRail: () => <div data-testid="card-rail" />,
  RAIL_GAP: 3.1,
}))
// The CRT vignette loads a GLB and swaps an emissive canvas texture — neither
// works under vitest. Swap it for an inert node so AboutSection renders its HTML.
vi.mock('@/components/labs/memory-card/three/crt-vignette', () => ({
  CrtVignette: () => <div data-testid="crt-vignette" />,
}))

import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { HeroSection } from '@/components/labs/memory-card/sections/hero'
import { SkillsSection } from '@/components/labs/memory-card/sections/skills'
import { WorkSection } from '@/components/labs/memory-card/sections/work'
import { AboutSection } from '@/components/labs/memory-card/sections/about'
import { ContactSection } from '@/components/labs/memory-card/sections/contact'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'
import { GlyphCursor } from '@/components/labs/memory-card/cursor'
import { WRITTEN_WITH } from '@/components/labs/memory-card/lib/written-with'
import { projects } from '@/data/projects'

beforeEach(() => {
  mockAudioEnabled = false
})

describe('MemoryCardChrome', () => {
  it('renders the four section anchors with correct hrefs', () => {
    render(<MemoryCardChrome />)
    const anchors: Record<string, string> = {
      work: '#work',
      skills: '#skills',
      about: '#about',
      contact: '#contact',
    }
    for (const [label, href] of Object.entries(anchors)) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('renders a skip link that jumps to the content', () => {
    render(<MemoryCardChrome />)
    expect(
      screen.getByRole('link', { name: /skip to the content/i })
    ).toHaveAttribute('href', '#work')
  })

  // T6 review N2 (routed to Task 10): the toggle used to render aria-disabled
  // + cursor-not-allowed while onClick was already wired but inert. Sound is
  // live now, so the disabled affordance is gone — this test is deliberately
  // updated to assert the real thing (no aria-disabled, aria-pressed reflects
  // state) instead of the placeholder it replaced.
  it('renders the wordmark and a live, enabled sound toggle', () => {
    render(<MemoryCardChrome />)
    expect(screen.getByText(/memory card/i)).toBeInTheDocument()
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: off')
    expect(sound).not.toHaveAttribute('aria-disabled')
    expect(sound).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects the soundOn prop in the toggle label', () => {
    render(<MemoryCardChrome soundOn />)
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: on')
    expect(sound).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks nav anchors and the sound toggle for the glyph cursor', () => {
    render(<MemoryCardChrome />)
    for (const label of ['work', 'skills', 'about', 'contact']) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('data-cursor', 'triangle')
    }
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute(
      'data-cursor',
      'triangle'
    )
  })

  it('toggling the sound button calls setEnabled(true) and flips the label live', () => {
    render(
      <MemoryCardAudioProvider>
        <MemoryCardChrome />
      </MemoryCardAudioProvider>
    )
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: off')

    fireEvent.click(sound)

    expect(mockAudio.setEnabled).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: /sound/i })).toHaveTextContent('sound: on')
  })
})

describe('HeroSection', () => {
  it('renders the name from siteConfig, split across display lines', () => {
    render(<HeroSection />)
    const [first, ...rest] = siteConfig.name.split(' ')
    expect(screen.getByText(first)).toBeInTheDocument()
    expect(screen.getByText(rest.join(' '))).toBeInTheDocument()
  })

  it('renders the role verbatim from siteConfig and never a lead title', () => {
    render(<HeroSection />)
    expect(screen.getByText(siteConfig.title)).toBeInTheDocument()
    expect(screen.queryByText(/lead/i)).toBeNull()
  })

  it('mounts the character vignette inside an aria-hidden container', () => {
    render(<HeroSection />)
    const box = screen.getByTestId('hero-vignette')
    expect(box).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('gltf-vignette')).toBeInTheDocument()
  })
})

describe('SkillsSection', () => {
  it('has id="skills" on the section root', () => {
    const { container } = render(<SkillsSection />)
    expect(container.querySelector('section#skills')).toBeInTheDocument()
  })

  it('renders every curated entry name and its usage note as real text', () => {
    render(<SkillsSection />)
    for (const entry of WRITTEN_WITH) {
      expect(screen.getByText(entry.name)).toBeInTheDocument()
      expect(screen.getByText(entry.note)).toBeInTheDocument()
    }
  })

  it('links out to the full stack on the main site', () => {
    render(<SkillsSection />)
    const link = screen.getByRole('link', { name: /full save data lives in the main site/i })
    expect(link).toHaveAttribute('href', '/#skills')
    expect(link).toHaveAttribute('data-cursor', 'cross')
  })
})

describe('WorkSection', () => {
  it('has id="work" on the section root', () => {
    const { container } = render(<WorkSection />)
    expect(container.querySelector('section#work')).toBeInTheDocument()
  })

  it('renders every project as an article in the crawlable list', () => {
    render(<WorkSection />)
    const list = screen.getByTestId('work-crawl')
    for (const project of projects) {
      expect(within(list).getByText(project.title)).toBeInTheDocument()
    }
  })

  it('renders all metrics for every project', () => {
    render(<WorkSection />)
    const list = screen.getByTestId('work-crawl')
    for (const project of projects) {
      for (const metric of project.metrics ?? []) {
        expect(within(list).getByText(metric)).toBeInTheDocument()
      }
    }
  })

  it('zero-pads the slot number of each project in the list', () => {
    render(<WorkSection />)
    const list = screen.getByTestId('work-crawl')
    projects.forEach((_, idx) => {
      const slot = String(idx + 1).padStart(2, '0')
      expect(within(list).getByText(`slot ${slot}`)).toBeInTheDocument()
    })
  })

  it('renders "company · year" verbatim for every project (year is a string)', () => {
    render(<WorkSection />)
    const list = screen.getByTestId('work-crawl')
    for (const project of projects) {
      expect(
        within(list).getByText(`${project.company} · ${project.year}`)
      ).toBeInTheDocument()
    }
  })

  // T8 review N1 (routed to Task 10): the seam grew a direction argument so
  // callers can tell a reveal from a return instead of a bare fire-and-forget.
  it('reports the flip direction through onCardFlip: reveal then return', () => {
    const onCardFlip = vi.fn()
    render(<WorkSection onCardFlip={onCardFlip} />)
    const stage = screen.getByTestId('work-stage')

    fireEvent.click(stage)
    expect(onCardFlip).toHaveBeenLastCalledWith('reveal')

    fireEvent.click(stage)
    expect(onCardFlip).toHaveBeenLastCalledWith('return')
  })

  it('marks the stage for the circle glyph cursor', () => {
    render(<WorkSection />)
    expect(screen.getByTestId('work-stage')).toHaveAttribute('data-cursor', 'circle')
  })
})

describe('AboutSection', () => {
  it('has id="about" on the section root', () => {
    const { container } = render(<AboutSection />)
    expect(container.querySelector('section#about')).toBeInTheDocument()
  })

  it('renders a verbatim bio sentence as real DOM text (claims law)', () => {
    render(<AboutSection />)
    expect(
      screen.getByText(
        "Currently at xDataGroup, I build the frontend of AMIO Bank's retail banking platform while collaborating directly with founders on an early-stage PropTech startup."
      )
    ).toBeInTheDocument()
  })

  it('never renders a lead title', () => {
    render(<AboutSection />)
    expect(screen.queryByText(/lead/i)).toBeNull()
  })

  it('renders the oversized mono ornament line', () => {
    render(<AboutSection />)
    expect(
      screen.getByText('8 yrs · fintech systems · yerevan → worldwide')
    ).toBeInTheDocument()
  })

  it('mounts the CRT vignette inside an aria-hidden container', () => {
    render(<AboutSection />)
    const box = screen.getByTestId('about-vignette')
    expect(box).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('crt-vignette')).toBeInTheDocument()
  })
})

describe('ContactSection', () => {
  it('has id="contact" on the section root', () => {
    const { container } = render(<ContactSection />)
    expect(container.querySelector('section#contact')).toBeInTheDocument()
  })

  it('renders the save-prompt heading', () => {
    render(<ContactSection />)
    expect(
      screen.getByRole('heading', { name: /save your progress/i })
    ).toBeInTheDocument()
  })

  it('renders all three contact values, each with a copy button', () => {
    render(<ContactSection />)
    const values = [
      siteConfig.email,
      ...socialLinks.map((s) => s.url.replace(/^https?:\/\//, '')),
    ]
    for (const value of values) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: /copy/i })).toHaveLength(3)
  })

  it('links to the gallery and cross-links every hall lab except this one', () => {
    render(<ContactSection />)
    const footer = screen.getByTestId('contact-footer')
    expect(
      within(footer).getByRole('link', { name: /gallery/i })
    ).toHaveAttribute('href', '/labs')
    for (const lab of hallLabs) {
      if (lab.slug === 'memory-card') {
        expect(within(footer).queryByText(lab.title)).toBeNull()
      } else {
        expect(within(footer).getByText(lab.title)).toBeInTheDocument()
      }
    }
  })

  it('renders both CC-BY attribution lines (license law)', () => {
    render(<ContactSection />)
    expect(
      screen.getByText(/crt model by meipal \(cc by 4\.0\)/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/character by humans of the world \(cc by 4\.0\)/i)
    ).toBeInTheDocument()
  })

  it('marks copy buttons and footer links for the triangle glyph cursor', () => {
    render(<ContactSection />)
    for (const button of screen.getAllByRole('button', { name: /copy/i })) {
      expect(button).toHaveAttribute('data-cursor', 'triangle')
    }
    const footer = screen.getByTestId('contact-footer')
    expect(within(footer).getByRole('link', { name: /gallery/i })).toHaveAttribute(
      'data-cursor',
      'triangle'
    )
  })
})

describe('GlyphCursor', () => {
  it('renders nothing on first paint', () => {
    const { container } = render(<GlyphCursor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the dot once a real pointermove event arrives', () => {
    const { container } = render(<GlyphCursor />)
    expect(container).toBeEmptyDOMElement()

    fireEvent(window, new PointerEvent('pointermove', { clientX: 120, clientY: 80 }))

    expect(screen.getByTestId('glyph-cursor')).toBeInTheDocument()
  })

  // Same matcher shape vitest.setup.ts installs globally, but with `matches`
  // driven by the query string so a single override can stand in for either
  // `(prefers-reduced-motion: reduce)` or `(pointer: coarse)`.
  function mockMatchMedia(matchesFor: (query: string) => boolean) {
    return vi.fn((query: string) => ({
      matches: matchesFor(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }

  // Reduced-motion hiding is gated by framer-motion's `useReducedMotion()`
  // (the same hook every other section in this lab already relies on for its
  // own reduced-motion branch) rather than a matchMedia check this file owns,
  // and that hook memoizes its query result process-wide — a per-test
  // matchMedia override here would just prove the mock, not the component.
  // Reduced-motion hiding is exercised live instead (self-check).

  it('stays hidden under a coarse pointer, even after a pointermove', () => {
    const original = window.matchMedia
    window.matchMedia = mockMatchMedia((q) => q.includes('coarse'))
    try {
      const { container } = render(<GlyphCursor />)
      fireEvent(window, new PointerEvent('pointermove', { clientX: 120, clientY: 80 }))
      expect(container).toBeEmptyDOMElement()
    } finally {
      window.matchMedia = original
    }
  })
})
