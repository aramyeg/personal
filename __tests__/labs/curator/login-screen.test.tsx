import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginScreen } from '@/components/labs/curator/login-screen'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

describe('LoginScreen', () => {
  beforeEach(() => {
    refresh.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('pre-fills demo credentials', () => {
    render(<LoginScreen />)
    expect(screen.getByLabelText(/work email/i)).toHaveValue('operator@curator.app')
    expect(screen.getByLabelText(/password/i)).not.toHaveValue('')
  })

  it('shows a zod error for an invalid email without calling the API', async () => {
    render(<LoginScreen />)
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs credentials and refreshes on success', async () => {
    render(<LoginScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith('/api/labs/curator/session', expect.objectContaining({ method: 'POST' }))
  })

  it('signs in via SSO button too', async () => {
    render(<LoginScreen />)
    fireEvent.click(screen.getByRole('button', { name: /continue with sso/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
