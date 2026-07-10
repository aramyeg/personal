// @vitest-environment node
import { signSession, verifySession } from '@/components/labs/curator/server/session'

describe('curator session', () => {
  it('round-trips a signed session', async () => {
    const token = await signSession('recruiter@example.com')
    const session = await verifySession(token)
    expect(session).toEqual({ email: 'recruiter@example.com' })
  })
  it('rejects undefined, garbage, and tampered tokens', async () => {
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession('not-a-jwt')).toBeNull()
    const token = await signSession('a@b.co')
    expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull()
  })
})
