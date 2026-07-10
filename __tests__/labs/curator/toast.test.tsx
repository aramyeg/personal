import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastViewport } from '@/components/labs/curator/ui/toast'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
})

describe('ToastViewport', () => {
  it('renders pushed toasts in a role="status" container and auto-dismisses after 5s', () => {
    vi.useFakeTimers()
    try {
      render(<ToastViewport />)
      act(() => {
        useCuratorStore.getState().pushToast({ title: 'Saved', description: 'Settings updated' })
      })
      const viewport = screen.getByRole('status')
      expect(viewport).toContainElement(screen.getByText('Saved'))
      expect(screen.getByText('Settings updated')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(useCuratorStore.getState().toasts).toHaveLength(0)
      expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dismisses a toast immediately via its dismiss button', () => {
    render(<ToastViewport />)
    act(() => {
      useCuratorStore.getState().pushToast({ title: 'Bye' })
    })
    expect(screen.getByText('Bye')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(useCuratorStore.getState().toasts).toHaveLength(0)
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })
})
