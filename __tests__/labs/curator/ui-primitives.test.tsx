import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/labs/curator/ui/badge'
import { KpiCard } from '@/components/labs/curator/ui/kpi-card'
import { Skeleton } from '@/components/labs/curator/ui/skeleton'
import styles from '@/components/labs/curator/curator.module.css'

describe('Badge', () => {
  it('renders label with tone class', () => {
    render(<Badge tone="ok">Live</Badge>)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
  it('renders all four tones with their tone styling', () => {
    render(
      <>
        <Badge tone="ok">Ok</Badge>
        <Badge tone="warn">Warn</Badge>
        <Badge tone="bad">Bad</Badge>
        <Badge>Neutral</Badge>
      </>,
    )
    expect(screen.getByText('Ok')).toHaveClass('bg-[#e6f4ec]', 'text-[var(--c-ok)]')
    expect(screen.getByText('Warn')).toHaveClass('bg-[#fdf0e3]', 'text-[var(--c-warn)]')
    expect(screen.getByText('Bad')).toHaveClass('bg-[#fae8ec]', 'text-[var(--c-bad)]')
    expect(screen.getByText('Neutral')).toHaveClass('bg-[#eef1f6]', 'text-[var(--c-text-soft)]')
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
  it('renders without delta or caption', () => {
    const { container } = render(<KpiCard label="Sessions" value="42" />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.queryByText(/▲/)).toBeNull()
    expect(screen.queryByText(/▼/)).toBeNull()
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })
})

describe('Skeleton', () => {
  it('renders an aria-hidden shimmer block and merges className', () => {
    const { container } = render(<Skeleton className="h-4" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).toHaveClass(styles.skeleton, 'h-4')
  })
})
