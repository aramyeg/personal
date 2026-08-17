import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SmallWorldSign } from '@/components/labs/museum/small-world-sign'
import { atticLabs } from '@/lib/labs-manifest'

const remnant = atticLabs.find((l) => l.remnant)!

describe('SmallWorldSign', () => {
  it('shows the remnant plate and its remark', () => {
    render(<SmallWorldSign lab={remnant} onClose={() => {}} />)
    expect(screen.getByText('SMALL WORLD')).toBeInTheDocument()
    expect(screen.getByText(remnant.retrospective!)).toBeInTheDocument()
  })

  it('goes nowhere: the sign contains no navigation at all', () => {
    render(<SmallWorldSign lab={remnant} onClose={() => {}} />)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('lets the visitor back out by button, by backdrop and by Esc', () => {
    const onClose = vi.fn()
    render(<SmallWorldSign lab={remnant} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /back to the attic/i }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('does not close on a click inside the plate', () => {
    const onClose = vi.fn()
    render(<SmallWorldSign lab={remnant} onClose={onClose} />)
    fireEvent.click(screen.getByText('SMALL WORLD'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
