import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// next/font/google is compiled away by Next's loader — not available under
// vitest. The strips only need font-family strings, so stub the module.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// Direct action spies — no provider needed; the strips fire sounds inside
// their own event handlers.
const blip = vi.fn()
const select = vi.fn()
vi.mock('@/components/labs/memory-card/audio-context', () => ({
  useMemoryCardAudioActions: () => ({
    blip,
    select,
    back: vi.fn(),
    toggleSound: vi.fn(),
    boot: () => false,
  }),
}))

import { SaveStrips } from '@/components/labs/memory-card/save-select/save-strips'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

function setup(activeIndex = 0) {
  const onHighlight = vi.fn()
  const onActivate = vi.fn()
  const utils = render(
    <SaveStrips
      saves={saves}
      activeIndex={activeIndex}
      onHighlight={onHighlight}
      onActivate={onActivate}
    />
  )
  const buttons = screen.getAllByRole('button')
  return { ...utils, onHighlight, onActivate, buttons }
}

describe('SaveStrips', () => {
  it('renders one row per save with slot numerals 01–06 and the labels', () => {
    setup()
    for (const save of saves) {
      expect(screen.getByText(save.slot)).toBeInTheDocument()
      expect(screen.getByText(save.label)).toBeInTheDocument()
    }
  })

  it('renders exactly one focusable strip — the active one — with the rest at tabIndex -1', () => {
    const { buttons } = setup(2)
    expect(buttons).toHaveLength(saves.length)
    buttons.forEach((button, i) => {
      expect(button.tabIndex).toBe(i === 2 ? 0 : -1)
    })
    expect(buttons[2]).toHaveAttribute('aria-current', 'true')
  })

  it('ArrowDown highlights and focuses the next strip', () => {
    const { buttons, onHighlight } = setup(0)
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(1)
    expect(document.activeElement).toBe(buttons[1])
  })

  it('ArrowDown wraps from the last strip back to the first', () => {
    const { buttons, onHighlight } = setup(saves.length - 1)
    buttons[saves.length - 1].focus()
    fireEvent.keyDown(buttons[saves.length - 1], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(0)
    expect(document.activeElement).toBe(buttons[0])
  })

  it('ArrowUp wraps from the first strip to the last', () => {
    const { buttons, onHighlight } = setup(0)
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowUp' })
    expect(onHighlight).toHaveBeenCalledWith(saves.length - 1)
    expect(document.activeElement).toBe(buttons[saves.length - 1])
  })

  it('Enter activates the highlighted save', () => {
    const { buttons, onActivate } = setup(1)
    fireEvent.keyDown(buttons[1], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(saves[1])
  })

  it('a click on a non-active strip highlights it (never activates)', () => {
    const { buttons, onHighlight, onActivate } = setup(0)
    fireEvent.click(buttons[3])
    expect(onHighlight).toHaveBeenCalledWith(3)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('a second click — on the already-active strip — activates it', () => {
    const { buttons, onActivate } = setup(2)
    fireEvent.click(buttons[2])
    expect(onActivate).toHaveBeenCalledWith(saves[2])
  })

  it('blips on every highlight change but not when re-clicking the active strip', () => {
    const { buttons } = setup(0)
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' })
    fireEvent.click(buttons[4])
    expect(blip).toHaveBeenCalledTimes(2)
  })
})
