import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { experiences } from '@/data'
import { PlainTale } from '@/components/labs/storybook/plain-tale'

describe('PlainTale', () => {
  it('tells every kingdom with real facts', () => {
    render(<PlainTale />)
    for (const exp of experiences) {
      expect(screen.getByText(new RegExp(exp.company.replace(/[/\\]/g, '.')))).toBeInTheDocument()
      expect(screen.getAllByText(new RegExp(exp.period)).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/Vault-Dragon/)).toBeInTheDocument()
  })
  it('offers contact and the satchel', () => {
    render(<PlainTale />)
    expect(screen.getByRole('link', { name: /send a raven/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:')
    )
    expect(screen.getByText(/Ever-Sharp Sword/)).toBeInTheDocument()
  })
})
