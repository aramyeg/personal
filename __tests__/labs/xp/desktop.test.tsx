import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { XpDesktop } from '@/components/labs/xp/xp-desktop'
import { useXpStore } from '@/components/labs/xp/store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const initial = useXpStore.getState()

describe('XpDesktop', () => {
  beforeEach(() => {
    useXpStore.setState({ ...initial, phase: 'desktop' }, true)
    window.sessionStorage.clear()
  })

  it('double-clicking a desktop icon opens its window', () => {
    render(<XpDesktop />)
    fireEvent.doubleClick(screen.getByText('about-me.txt'))
    expect(useXpStore.getState().windows).toHaveLength(1)
    expect(screen.getByTestId('window-about')).toBeInTheDocument()
  })

  it('double-clicking free_ringtones.exe starts the chaos cascade', () => {
    render(<XpDesktop />)
    fireEvent.doubleClick(screen.getByText('free_ringtones.exe'))
    expect(useXpStore.getState().chaos).toBe('cascade')
  })
})
