import { describe, expect, it } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { briefs, getBrief } from '@/components/labs/curator/annotations'
import { SpecChip } from '@/components/labs/curator/ui/spec-chip'

describe('annotations', () => {
  it('has at least nine briefs with unique sequential ids', () => {
    expect(briefs.length).toBeGreaterThanOrEqual(9)
    expect(new Set(briefs.map((b) => b.id)).size).toBe(briefs.length)
    expect(briefs[0].id).toBe('EB-001')
  })
  it('getBrief throws on unknown id', () => {
    expect(() => getBrief('EB-999')).toThrow()
  })
})

describe('SpecChip', () => {
  it('opens the brief popover and closes on Escape without bubbling to GalleryChrome', () => {
    render(<SpecChip briefId="EB-001" />)
    fireEvent.click(screen.getByRole('button', { name: /spec/i }))
    expect(screen.getByText(/ENGINEERING BRIEF · EB-001/)).toBeInTheDocument()
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      document.body.dispatchEvent(escape)
    })
    expect(escape.defaultPrevented).toBe(true)
    expect(screen.queryByText(/ENGINEERING BRIEF/)).not.toBeInTheDocument()
  })
})
