import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { siteConfig } from '@/lib/constants'

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

import { MemoryCardChrome } from '@/components/labs/memory-card/sections/chrome'
import { HeroSection } from '@/components/labs/memory-card/sections/hero'
import { LEVEL_SEGMENTS, SkillsSection, skillSlug } from '@/components/labs/memory-card/sections/skills'
import { skills, skillCategories, getSkillsByCategory } from '@/data/skills'

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

  it('renders every skill name from the imported data', () => {
    render(<SkillsSection />)
    for (const skill of skills) {
      expect(screen.getByText(skill.name)).toBeInTheDocument()
    }
  })

  it('renders every category label with a non-empty skill list', () => {
    render(<SkillsSection />)
    for (const category of skillCategories) {
      if (getSkillsByCategory(category.id).length > 0) {
        expect(screen.getByText(category.label)).toBeInTheDocument()
      }
    }
  })

  it('renders each skill row as an accessible group with name/level/years', () => {
    render(<SkillsSection />)
    const react = skills.find((s) => s.name === 'React')!
    expect(
      screen.getByRole('group', { name: `${react.name}: ${react.level}, ${react.years} yrs` })
    ).toBeInTheDocument()
  })

  it('renders an HP bar with segment count computed from the imported LEVEL_SEGMENTS map', () => {
    const { container } = render(<SkillsSection />)
    // Prisma is the lone 'intermediate' skill in the data — an unambiguous fixture.
    const prisma = skills.find((s) => s.name === 'Prisma')!
    const bar = container.querySelector(`[data-testid="hp-bar-${skillSlug(prisma.name)}"]`)
    expect(bar).toBeTruthy()
    expect(bar).toHaveAttribute('aria-hidden', 'true')
    const filled = bar!.querySelectorAll('[data-filled="true"]')
    const empty = bar!.querySelectorAll('[data-filled="false"]')
    expect(filled.length).toBe(LEVEL_SEGMENTS[prisma.level])
    expect(filled.length + empty.length).toBe(12)
  })
})
