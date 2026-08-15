import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FocusCard } from '@/components/labs/museum/focus-card'
import { atticLabs, hallLabs } from '@/lib/labs-manifest'

describe('FocusCard', () => {
  it('shows title, date, full thesis and the enter action', () => {
    const lab = hallLabs[0]
    render(<FocusCard lab={lab} />)
    expect(screen.getByText(lab.title)).toBeInTheDocument()
    expect(screen.getByText(lab.date)).toBeInTheDocument()
    expect(screen.getByText(lab.thesis)).toBeInTheDocument()
    expect(screen.getByText(/click to enter/i)).toBeInTheDocument()
  })

  it('labels live and attic statuses differently', () => {
    const live = hallLabs.find((l) => l.status === 'live')!
    const { unmount } = render(<FocusCard lab={live} />)
    expect(screen.getByText('on display')).toBeInTheDocument()
    unmount()
    render(<FocusCard lab={atticLabs[0]} />)
    expect(screen.getByText('retired — attic')).toBeInTheDocument()
  })
})
