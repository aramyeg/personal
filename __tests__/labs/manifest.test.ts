import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { labs, hallLabs, atticLabs, labHref } from '@/lib/labs-manifest'

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

  it('retires memory-card to the attic with a retrospective', () => {
    const memoryCard = atticLabs.find((l) => l.slug === 'memory-card')
    expect(memoryCard).toBeDefined()
    expect(memoryCard!.retrospective).toContain('Two builds, one lesson.')
    expect(memoryCard!.retrospective).toContain('still playable, as evidence')
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

  it('keeps small world as a remnant: a sign in the attic, with no room behind it', () => {
    const sw = atticLabs.find((l) => l.slug === 'small-world')
    expect(sw).toBeDefined()
    expect(sw!.remnant).toBe(true)
    expect(sw!.href).toBeUndefined()
    expect(sw!.retrospective).toContain('The museum kept the loading screen.')
    expect(labHref(sw!)).toBeNull()
  })

  it('resolves a route for every lab that is not a remnant', () => {
    for (const lab of labs) {
      expect(labHref(lab) === null).toBe(lab.remnant === true)
    }
  })

  it('never points a lab at a route this build does not ship', () => {
    for (const lab of labs) {
      const href = labHref(lab)
      if (href === null) continue
      const route = join(process.cwd(), 'app', href, 'page.tsx')
      expect(existsSync(route), `${lab.slug} routes to ${href}, which has no page`).toBe(true)
    }
  })

  it('demotes the main site to a hall painting at /classic-claude', () => {
    const main = hallLabs.find((l) => l.slug === 'main')
    expect(main).toBeDefined()
    expect(main!.title).toBe('Classic Claude')
    expect(main!.href).toBe('/classic-claude')
    expect(main!.status).toBe('live')
  })
})
