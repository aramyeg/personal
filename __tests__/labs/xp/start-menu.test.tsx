import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StartMenu } from '@/components/labs/xp/start-menu'
import { useXpStore } from '@/components/labs/xp/store'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const initial = useXpStore.getState()

describe('StartMenu', () => {
  beforeEach(() => {
    useXpStore.setState({ ...initial, startOpen: true }, true)
    push.mockClear()
  })

  it('opens an app and closes the menu', () => {
    render(<StartMenu />)
    fireEvent.click(screen.getByText('My Projects'))
    const s = useXpStore.getState()
    expect(s.windows.some((w) => w.app === 'my-projects')).toBe(true)
    expect(s.startOpen).toBe(false)
  })

  it('Turn Off Computer → Turn Off exits to the gallery', () => {
    render(<StartMenu />)
    fireEvent.click(screen.getByText('Turn Off Computer'))
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }))
    expect(push).toHaveBeenCalledWith('/')
  })

  it('renders nothing when closed', () => {
    useXpStore.setState({ ...initial, startOpen: false }, true)
    const { container } = render(<StartMenu />)
    expect(container.firstChild).toBeNull()
  })
})
