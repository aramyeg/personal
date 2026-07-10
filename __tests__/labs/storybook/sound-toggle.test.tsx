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
})
