import { describe, expect, it } from 'vitest'
import { labs, hallLabs, atticLabs } from '@/lib/labs-manifest'

describe('labs manifest attic split', () => {
  it('splits the manifest into hall and attic without losing entries', () => {
    expect(hallLabs.length + atticLabs.length).toBe(labs.length)
    expect(hallLabs.some((l) => l.status === 'attic')).toBe(false)
    expect(atticLabs.every((l) => l.status === 'attic')).toBe(true)
  })

  it('retires snowpark to the attic with a retrospective', () => {
    const snowpark = atticLabs.find((l) => l.slug === 'snowpark')
    expect(snowpark).toBeDefined()
    expect(snowpark!.retrospective).toContain('Three passes, three verdicts.')
    expect(snowpark!.retrospective).toContain('still playable, as evidence')
  })

  it('every attic entry carries a retrospective', () => {
    expect(atticLabs.every((l) => !!l.retrospective)).toBe(true)
  })

  it('hangs the xp lab in the hall', () => {
    const xp = hallLabs.find((l) => l.slug === 'xp')
    expect(xp).toBeDefined()
    expect(xp!.title).toBe('Bliss')
    expect(xp!.status).toBe('live')
  })
})
