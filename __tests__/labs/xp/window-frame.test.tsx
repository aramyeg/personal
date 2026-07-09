import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WindowFrame } from '@/components/labs/xp/window-frame'
import { useXpStore } from '@/components/labs/xp/store'

const initial = useXpStore.getState()

describe('WindowFrame', () => {
  beforeEach(() => useXpStore.setState(initial, true))

  it('renders title and children, close removes the window', () => {
    useXpStore.getState().openWindow('about', { title: 'about-me.txt - Notepad' })
    const win = useXpStore.getState().windows[0]
    render(<WindowFrame win={win}>hello</WindowFrame>)
    expect(screen.getByText('about-me.txt - Notepad')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useXpStore.getState().windows).toHaveLength(0)
  })

  it('minimize hides via store; maximize toggles', () => {
    useXpStore.getState().openWindow('about', { title: 'about' })
    const win = useXpStore.getState().windows[0]
    render(<WindowFrame win={win}>x</WindowFrame>)
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(useXpStore.getState().windows[0].minimized).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    expect(useXpStore.getState().windows[0].maximized).toBe(true)
  })
})
