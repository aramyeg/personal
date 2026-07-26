import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SoundToggle } from '@/components/labs/storybook/overlay/sound-toggle'
import { useStorybookStore } from '@/components/labs/storybook/store'

const initial = useStorybookStore.getState()

describe('SoundToggle', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))

  it('reflects the store default: sound off, aria-pressed false', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button', { name: /unmute paper sounds/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking toggles both the store flag and the button label/state', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button', { name: /unmute paper sounds/i })

    fireEvent.click(button)
    expect(useStorybookStore.getState().soundOn).toBe(true)
    expect(screen.getByRole('button', { name: /mute paper sounds/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.click(screen.getByRole('button', { name: /mute paper sounds/i }))
    expect(useStorybookStore.getState().soundOn).toBe(false)
    expect(screen.getByRole('button', { name: /unmute paper sounds/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('carries the shared hover hook for the custom quill cursor', () => {
    render(<SoundToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('data-sb-hover')
  })

  // Blind sweep 2026-07-26: aria-label flipped correctly while the PIXELS
  // never changed ("clicking it changed exactly nothing on screen"). A test
  // that only asserts aria-label/aria-pressed — as every test above this one
  // does — would not have caught that bug, because the DOM was already
  // right. These assert the visual glyph itself: the mute-strike mark is
  // present only when muted, the ring-chime mark only when unmuted (a
  // silhouette difference, not just a color/opacity tweak), and the
  // button's own state attribute/ring-color track the same flip.
  it('shows the mute strike glyph (never the ring-chime glyph) while muted', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button', { name: /unmute paper sounds/i })
    expect(button).toHaveAttribute('data-sb-sound-state', 'off')
    expect(button.querySelector('[data-sb-sound-glyph="mute"]')).not.toBeNull()
    expect(button.querySelector('[data-sb-sound-glyph="ring"]')).toBeNull()
  })

  it('swaps to the ring-chime glyph (never the mute strike) once unmuted, and back again on re-mute', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button')

    fireEvent.click(button)
    expect(button).toHaveAttribute('data-sb-sound-state', 'on')
    expect(button.querySelector('[data-sb-sound-glyph="ring"]')).not.toBeNull()
    expect(button.querySelector('[data-sb-sound-glyph="mute"]')).toBeNull()

    fireEvent.click(button)
    expect(button).toHaveAttribute('data-sb-sound-state', 'off')
    expect(button.querySelector('[data-sb-sound-glyph="mute"]')).not.toBeNull()
    expect(button.querySelector('[data-sb-sound-glyph="ring"]')).toBeNull()
  })

  it('the ring color itself flips between the sealed-wax red (muted) and bright gold (unmuted) tokens', () => {
    render(<SoundToggle />)
    const button = screen.getByRole('button')

    expect(button.className).toContain('--sb-seal')
    expect(button.className).not.toContain('--sb-gold-bright')

    fireEvent.click(button)
    expect(button.className).toContain('--sb-gold-bright')
    expect(button.className).not.toContain('--sb-seal')
  })
})
