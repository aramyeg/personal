import { requesterSchema, detailsSchema, ticketId, ticketMailto } from '@/components/labs/curator/ticket-schema'

describe('ticket schemas', () => {
  it('accepts a valid requester', () => {
    expect(requesterSchema.safeParse({ name: 'Jane Doe', email: 'j@d.co' }).success).toBe(true)
  })
  it('rejects short names and bad emails with messages', () => {
    const r = requesterSchema.safeParse({ name: 'J', email: 'nope' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Enter your full name.')
      expect(msgs).toContain('Enter a valid email address.')
    }
  })
  it('enforces the message floor', () => {
    expect(detailsSchema.safeParse({ category: 'other', priority: 'low', message: 'too short' }).success).toBe(false)
  })
})

describe('ticket helpers', () => {
  it('formats ids', () => {
    expect(ticketId(0)).toMatch(/^AY-\d{4}$/)
    expect(ticketId(1)).not.toBe(ticketId(2))
  })
  it('builds a mailto with encoded subject and body', () => {
    const url = ticketMailto(
      { name: 'Jane', email: 'j@d.co', category: 'job-opportunity', priority: 'high', message: 'A serious inquiry about a role.' },
      'me@example.com'
    )
    expect(url.startsWith('mailto:me@example.com?subject=')).toBe(true)
    expect(url).toContain(encodeURIComponent('Job opportunity'))
    expect(url).toContain(encodeURIComponent('A serious inquiry'))
  })
})
