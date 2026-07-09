import { beforeEach, describe, expect, it } from 'vitest'
import { CHAOS_DIALOG_CAP, useXpStore } from '@/components/labs/xp/store'

const initial = useXpStore.getState()

describe('xp window manager', () => {
  beforeEach(() => useXpStore.setState(initial, true))

  it('opens a window focused on top', () => {
    useXpStore.getState().openWindow('about')
    const s = useXpStore.getState()
    expect(s.windows).toHaveLength(1)
    expect(s.activeId).toBe('about')
    expect(s.windows[0].z).toBe(1)
  })

  it('re-opening an app focuses the existing window instead of duplicating', () => {
    const a = useXpStore.getState()
    a.openWindow('about')
    a.openWindow('resume')
    a.openWindow('about')
    const s = useXpStore.getState()
    expect(s.windows).toHaveLength(2)
    expect(s.activeId).toBe('about')
    const about = s.windows.find((w) => w.id === 'about')!
    const resume = s.windows.find((w) => w.id === 'resume')!
    expect(about.z).toBeGreaterThan(resume.z)
  })

  it('project-detail windows are keyed by param', () => {
    const a = useXpStore.getState()
    a.openWindow('project-detail', { param: 'p1', title: 'One' })
    a.openWindow('project-detail', { param: 'p2', title: 'Two' })
    expect(useXpStore.getState().windows).toHaveLength(2)
  })

  it('taskbar click minimizes the active window and restores a minimized one', () => {
    const a = useXpStore.getState()
    a.openWindow('about')
    a.clickTaskButton('about')
    expect(useXpStore.getState().windows[0].minimized).toBe(true)
    expect(useXpStore.getState().activeId).toBeNull()
    a.clickTaskButton('about')
    const s = useXpStore.getState()
    expect(s.windows[0].minimized).toBe(false)
    expect(s.activeId).toBe('about')
  })

  it('close removes the window and hands focus to the next-highest', () => {
    const a = useXpStore.getState()
    a.openWindow('about')
    a.openWindow('resume')
    a.closeWindow('resume')
    const s = useXpStore.getState()
    expect(s.windows).toHaveLength(1)
    expect(s.activeId).toBe('about')
  })

  it('error cascade spawns two per close, then blue-screens at the cap', () => {
    const a = useXpStore.getState()
    a.startChaos()
    expect(useXpStore.getState().chaos).toBe('cascade')
    expect(useXpStore.getState().chaosDialogs).toEqual([0])
    let guard = 0
    while (useXpStore.getState().chaos === 'cascade' && guard++ < 50) {
      const s = useXpStore.getState()
      s.closeChaosDialog(s.chaosDialogs[0])
    }
    expect(useXpStore.getState().chaos).toBe('bsod')
    expect(useXpStore.getState().chaosSpawned).toBeGreaterThanOrEqual(CHAOS_DIALOG_CAP)
  })

  it('reboot clears chaos but keeps windows', () => {
    const a = useXpStore.getState()
    a.openWindow('about')
    a.startChaos()
    useXpStore.setState({ chaos: 'bsod' })
    a.rebootFromBsod()
    const s = useXpStore.getState()
    expect(s.chaos).toBe('idle')
    expect(s.chaosDialogs).toEqual([])
    expect(s.windows).toHaveLength(1)
  })
})
