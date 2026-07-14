import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activeGrabId,
  beginGrabChannel,
  clearUserDrive,
  endGrabChannel,
  listUserDriveIds,
  readUserDrive,
  writeUserDrive,
} from '@/components/labs/storybook/user-drive'

describe('user-drive channel', () => {
  afterEach(() => {
    for (const id of listUserDriveIds()) clearUserDrive(id)
    if (activeGrabId() !== null) endGrabChannel(activeGrabId() as string)
  })

  it('write/read round-trips a value for an id', () => {
    writeUserDrive('tab-1', 0.42)
    expect(readUserDrive('tab-1')).toBe(0.42)
  })

  it('read returns undefined for an id never written', () => {
    expect(readUserDrive('nope')).toBeUndefined()
  })

  it('clear removes only the given id', () => {
    writeUserDrive('tab-1', 0.1)
    writeUserDrive('knob-1', 0.2)
    clearUserDrive('tab-1')
    expect(readUserDrive('tab-1')).toBeUndefined()
    expect(readUserDrive('knob-1')).toBe(0.2)
  })

  it('write clamps into the given bounds', () => {
    writeUserDrive('tab-1', 5, [0, 1])
    expect(readUserDrive('tab-1')).toBe(1)
    writeUserDrive('tab-1', -5, [0, 1])
    expect(readUserDrive('tab-1')).toBe(0)
    writeUserDrive('tab-1', 0.6, [0, 1])
    expect(readUserDrive('tab-1')).toBe(0.6)
  })

  it('write without bounds stores the raw value', () => {
    writeUserDrive('knob-1', -12.5)
    expect(readUserDrive('knob-1')).toBe(-12.5)
  })

  it('listUserDriveIds reflects current writes and clears', () => {
    writeUserDrive('a', 1)
    writeUserDrive('b', 2)
    expect([...listUserDriveIds()].sort()).toEqual(['a', 'b'])
    clearUserDrive('a')
    expect(listUserDriveIds()).toEqual(['b'])
  })

  it('grab bookkeeping: begin/active/end', () => {
    expect(activeGrabId()).toBeNull()
    beginGrabChannel('tab-1')
    expect(activeGrabId()).toBe('tab-1')
    endGrabChannel('tab-1')
    expect(activeGrabId()).toBeNull()
  })

  it('endGrabChannel only clears when the id matches the active grab', () => {
    beginGrabChannel('tab-1')
    endGrabChannel('some-other-id')
    expect(activeGrabId()).toBe('tab-1')
    endGrabChannel('tab-1')
    expect(activeGrabId()).toBeNull()
  })

  it('beginGrabChannel can switch the active id directly (no forced end first)', () => {
    beginGrabChannel('tab-1')
    beginGrabChannel('knob-1')
    expect(activeGrabId()).toBe('knob-1')
  })
})

describe('dev escape hatch gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is attached to window outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.resetModules()
    await import('@/components/labs/storybook/user-drive')
    expect((window as unknown as { __sbUserDrive?: unknown }).__sbUserDrive).toBeDefined()
  })

  it('is not attached to window in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()
    delete (window as unknown as { __sbUserDrive?: unknown }).__sbUserDrive
    await import('@/components/labs/storybook/user-drive')
    expect((window as unknown as { __sbUserDrive?: unknown }).__sbUserDrive).toBeUndefined()
  })
})
