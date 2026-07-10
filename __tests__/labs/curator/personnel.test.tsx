import { render, screen, fireEvent } from '@testing-library/react'
import PersonnelModule from '@/components/labs/curator/modules/personnel'
import { experiences } from '@/data/experience'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
})

describe('PersonnelModule', () => {
  it('paginates six records at page size 3', () => {
    render(<PersonnelModule />)
    expect(screen.getByText(`Page 1 of ${Math.ceil(experiences.length / 3)}`)).toBeInTheDocument()
    expect(screen.getAllByTestId('personnel-row')).toHaveLength(3)
  })
  it('navigates pages', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getByRole('button', { name: /next page/i }))
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
  })
  it('filters records and resets to page 1', () => {
    render(<PersonnelModule />)
    fireEvent.change(screen.getByPlaceholderText(/filter records/i), { target: { value: 'accenture' } })
    expect(screen.getAllByTestId('personnel-row')).toHaveLength(1)
    expect(screen.getByText('Accenture')).toBeInTheDocument()
  })
  it('sorts by company when header clicked', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getByRole('button', { name: /sort by company/i }))
    const first = screen.getAllByTestId('personnel-row')[0]
    expect(first).toHaveTextContent('360dialog')
  })
  it('expands a row to show highlights', () => {
    render(<PersonnelModule />)
    fireEvent.click(screen.getAllByRole('button', { name: /expand record/i })[0])
    expect(screen.getByText(experiences[0].highlights[0])).toBeInTheDocument()
  })
  it('gives every row expand action a distinct accessible name', () => {
    render(<PersonnelModule />)
    const buttons = screen.getAllByRole('button', { name: /expand record/i })
    const names = buttons.map((b) => b.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(names.length)
  })
  it('every column header carries scope="col"', () => {
    render(<PersonnelModule />)
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th).toHaveAttribute('scope', 'col')
    }
  })
  it('tightens cell padding when density is compact', () => {
    useCuratorStore.setState({ density: 'compact' })
    render(<PersonnelModule />)
    const cell = screen.getAllByTestId('personnel-row')[0].querySelector('td')
    expect(cell).toHaveClass('py-1.5')
  })
})
