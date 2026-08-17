import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabsList } from '@/components/labs/labs-list'
import { labHref, labs } from '@/lib/labs-manifest'
import { siteConfig } from '@/lib/constants'

describe('LabsList', () => {
  it('renders a link card for every lab that has a room to open', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const href = labHref(lab)
      if (href === null) continue
      const link = screen.getByRole('link', { name: new RegExp(lab.title) })
      expect(link).toHaveAttribute('href', href)
    }
  })

  it('renders a remnant unlinked, so the catalogue cannot reach a dead route', () => {
    render(<LabsList />)
    for (const lab of labs.filter((l) => l.remnant)) {
      expect(screen.queryByRole('link', { name: new RegExp(lab.title) })).toBeNull()
      // still catalogued: poster, placard and the remark are all present
      expect(screen.getByAltText(`${lab.title} poster`)).toBeInTheDocument()
      expect(screen.getByText(lab.retrospective!)).toBeInTheDocument()
    }
  })

  it('leaves no link anywhere in the catalogue pointing at a remnant', () => {
    render(<LabsList />)
    const dead = labs.filter((l) => l.remnant).map((l) => `/labs/${l.slug}`)
    for (const link of screen.getAllByRole('link')) {
      expect(dead).not.toContain(link.getAttribute('href'))
    }
  })

  it('shows each lab poster thumbnail', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const img = screen.getByAltText(`${lab.title} poster`)
      expect(img).toHaveAttribute('src', expect.stringContaining(`/labs/${lab.slug}/poster.jpg`))
    }
  })

  it('renders the crawlable masthead with name, role and classic-site link', () => {
    render(<LabsList />)
    expect(screen.getByRole('heading', { level: 1, name: siteConfig.name })).toBeInTheDocument()
    expect(screen.getByText(siteConfig.title)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /classic site/i })).toHaveAttribute(
      'href',
      '/classic-claude'
    )
  })

  it('shows the failed experiments section with the retrospective', () => {
    render(<LabsList />)
    expect(screen.getByRole('heading', { name: 'failed experiments' })).toBeInTheDocument()
    expect(screen.getByText(/Three passes, three verdicts\./)).toBeInTheDocument()
  })

  it('renders the enterAction slot when provided', () => {
    render(<LabsList enterAction={<button type="button">Enter the 3D gallery</button>} />)
    expect(screen.getByRole('button', { name: /enter the 3d gallery/i })).toBeInTheDocument()
  })
})
