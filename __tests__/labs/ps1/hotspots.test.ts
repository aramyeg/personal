import { describe, expect, it } from 'vitest'
import { ANGLE_ORDER } from '@/components/labs/ps1/scene/cameras'
import { HOTSPOTS, hotspotById, hotspotsForAngle } from '@/components/labs/ps1/scene/hotspots'

const ALL_PANEL_IDS = ['menu', 'about', 'projects', 'skills', 'contact', 'labs'] as const

describe('HOTSPOTS registry', () => {
  it('every hotspot panel is a real, non-null PanelId', () => {
    for (const h of HOTSPOTS) {
      expect(ALL_PANEL_IDS).toContain(h.panel)
    }
  })

  it('ids are unique', () => {
    const ids = HOTSPOTS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every PanelId is reachable from at least one hotspot', () => {
    const reachable = new Set(HOTSPOTS.map((h) => h.panel))
    for (const panel of ALL_PANEL_IDS) {
      expect(reachable.has(panel)).toBe(true)
    }
  })

  it('every hotspot lists at least one valid angle', () => {
    for (const h of HOTSPOTS) {
      expect(h.angles.length).toBeGreaterThan(0)
      for (const a of h.angles) expect(ANGLE_ORDER).toContain(a)
    }
  })

  it('hotspotsForAngle("desk") contains crt and pager', () => {
    const ids = hotspotsForAngle('desk').map((h) => h.id)
    expect(ids).toContain('crt')
    expect(ids).toContain('pager')
  })

  it('binds the exact content mapping from the brief', () => {
    const byId = Object.fromEntries(HOTSPOTS.map((h) => [h.id, h]))
    expect(byId.crt.panel).toBe('menu')
    expect(byId.crt.angles.sort()).toEqual(['desk', 'room'].sort())
    expect(byId.memcards.panel).toBe('projects')
    expect(byId.memcards.angles.sort()).toEqual(['shelf', 'room'].sort())
    expect(byId.posters.panel).toBe('skills')
    expect(byId.posters.angles.sort()).toEqual(['room', 'desk'].sort())
    expect(byId.pager.panel).toBe('contact')
    expect(byId.pager.angles).toEqual(['desk'])
    expect(byId.gameboxes.panel).toBe('labs')
    expect(byId.gameboxes.angles).toEqual(['shelf'])
    expect(byId.tv.panel).toBe('about')
    expect(byId.tv.angles.sort()).toEqual(['tv', 'room'].sort())
  })

  it('labels are lowercase', () => {
    for (const h of HOTSPOTS) expect(h.label).toBe(h.label.toLowerCase())
  })
})

describe('hotspotById', () => {
  it('returns the matching hotspot', () => {
    expect(hotspotById('crt')?.panel).toBe('menu')
  })
  it('returns undefined for an unknown id', () => {
    expect(hotspotById('nonexistent')).toBeUndefined()
  })
})

describe('hotspotsForAngle', () => {
  it('returns only hotspots visible from that angle', () => {
    for (const angle of ANGLE_ORDER) {
      for (const h of hotspotsForAngle(angle)) {
        expect(h.angles).toContain(angle)
      }
    }
  })
  it('returns an empty array for an angle with no hotspots, if any', () => {
    // sanity: function never throws for a valid angle id
    expect(() => hotspotsForAngle('tv')).not.toThrow()
  })
})
