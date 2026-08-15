import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabsList } from '@/components/labs/labs-list'
import { labs } from '@/lib/labs-manifest'
import { siteConfig } from '@/lib/constants'

describe('LabsList', () => {
  it('renders a link card for every lab in the manifest', () => {
    render(<LabsList />)
    for (const lab of labs) {
      const link = screen.getByRole('link', { name: new RegExp(lab.title) })
      expect(link).toHaveAttribute('href', lab.href ?? `/labs/${lab.slug}`)
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
