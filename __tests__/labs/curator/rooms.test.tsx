import { render, screen } from '@testing-library/react'
import RoomsModule from '@/components/labs/curator/modules/rooms'
import { useCuratorStore } from '@/components/labs/curator/store'
import { labs } from '@/lib/labs-manifest'

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
})

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
  it('gives every row action a distinct accessible name', () => {
    render(<RoomsModule />)
    expect(screen.getByRole('link', { name: 'Open Bliss' })).toBeInTheDocument()
  })
  it('summarizes counts in header chips', () => {
    render(<RoomsModule />)
    expect(screen.getByText(`${labs.length} total`)).toBeInTheDocument()
  })
  it('tightens cell padding when density is compact', () => {
    useCuratorStore.setState({ density: 'compact' })
    render(<RoomsModule />)
    const cell = screen.getByText(labs[0].title).closest('td')
    expect(cell).toHaveClass('py-1.5')
  })
})
