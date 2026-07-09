import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/labs/curator/ui/badge'
import { KpiCard } from '@/components/labs/curator/ui/kpi-card'

describe('Badge', () => {
  it('renders label with tone class', () => {
    render(<Badge tone="ok">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})

describe('KpiCard', () => {
  it('renders label, value, positive delta and caption', () => {
    render(<KpiCard label="Weekly Visitors" value="1,283" delta={12.4} caption="Sample data" />)
    expect(screen.getByText('Weekly Visitors')).toBeInTheDocument()
    expect(screen.getByText('1,283')).toBeInTheDocument()
    expect(screen.getByText('▲ 12.4%')).toBeInTheDocument()
    expect(screen.getByText('Sample data')).toBeInTheDocument()
  })
  it('renders negative delta with ▼', () => {
    render(<KpiCard label="X" value="9" delta={-3.2} />)
    expect(screen.getByText('▼ 3.2%')).toBeInTheDocument()
  })
})
