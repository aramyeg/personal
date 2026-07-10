import { render, screen } from '@testing-library/react'
import RoomsModule from '@/components/labs/curator/modules/rooms'
import { labs } from '@/lib/labs-manifest'

describe('RoomsModule', () => {
  it('renders one row per manifest lab — the single-source-of-truth guarantee', () => {
    render(<RoomsModule />)
    for (const lab of labs) {
      expect(screen.getByText(lab.title)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('row')).toHaveLength(labs.length + 1) // + header
  })
  it('links every room to its resolved href', () => {
    render(<RoomsModule />)
    const links = screen.getAllByRole('link', { name: /open/i })
    expect(links).toHaveLength(labs.length)
    expect(links.map((l) => l.getAttribute('href'))).toContain('/')
  })
  it('summarizes counts in header chips', () => {
    render(<RoomsModule />)
    expect(screen.getByText(`${labs.length} total`)).toBeInTheDocument()
  })
})
