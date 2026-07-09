import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Taskbar } from '@/components/labs/xp/taskbar'
import { useXpStore } from '@/components/labs/xp/store'

const initial = useXpStore.getState()

describe('Taskbar', () => {
  beforeEach(() => useXpStore.setState(initial, true))

  it('shows a button per open window; clicking the active one minimizes it', () => {
    useXpStore.getState().openWindow('about', { title: 'about-me.txt - Notepad' })
    render(<Taskbar />)
    fireEvent.click(screen.getByRole('button', { name: /about-me\.txt/ }))
    expect(useXpStore.getState().windows[0].minimized).toBe(true)
  })

  it('start button toggles the start menu flag; mute toggles sound', () => {
    render(<Taskbar />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(useXpStore.getState().startOpen).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sound' }))
    expect(useXpStore.getState().muted).toBe(true)
  })

  it('renders a clock', () => {
    render(<Taskbar />)
    expect(screen.getByTestId('tray-clock').textContent).toMatch(/\d{1,2}:\d{2}/)
  })
})
