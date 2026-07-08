import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabsList } from '@/components/labs/labs-list'
import { labs } from '@/lib/labs-manifest'

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

  it('links back to the main site', () => {
    render(<LabsList />)
    expect(screen.getByRole('link', { name: /main site/i })).toHaveAttribute('href', '/')
  })
})
