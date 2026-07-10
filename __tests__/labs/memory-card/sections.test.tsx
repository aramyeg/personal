import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { hallLabs } from '@/lib/labs-manifest'

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
import { WRITTEN_WITH } from '@/components/labs/memory-card/lib/written-with'
import { projects } from '@/data/projects'

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

  it('renders the wordmark and a sound toggle disabled until wired', () => {
    render(<MemoryCardChrome />)
    expect(screen.getByText(/memory card/i)).toBeInTheDocument()
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: off')
    expect(sound).toHaveAttribute('aria-disabled', 'true')
  })

  it('reflects the soundOn prop in the toggle label', () => {
    render(<MemoryCardChrome soundOn />)
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
    expect(
      screen.getByRole('link', { name: /full save data lives in the main site/i })
    ).toHaveAttribute('href', '/#skills')
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
})
