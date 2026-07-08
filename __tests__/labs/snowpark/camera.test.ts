import { describe, expect, it } from 'vitest'
import { CAM, addShake, createCamera, shakeOffset, updateCamera } from '@/components/labs/snowpark/camera'
import { compileCourse } from '@/components/labs/snowpark/course'
import { PHYS, createRider } from '@/components/labs/snowpark/rider'

const course = compileCourse()
const rider = createRider(course)

describe('camera', () => {
  it('converges toward the rider and never overshoots in one step', () => {
    let cam = { ...createCamera(rider), x: rider.x - 500 }
    const next = updateCamera(cam, rider, 1 / 60)
    expect(next.x).toBeGreaterThan(cam.x)
    expect(next.x).toBeLessThanOrEqual(rider.x + CAM.LEAD_MAX)
  })

  it('zooms out as speed rises, bounded by ZOOM_FAR', () => {
    const slow = { ...rider, speed: PHYS.MIN_SPEED }
    const fast = { ...rider, speed: PHYS.MAX_SPEED }
    let camSlow = createCamera(slow)
    let camFast = createCamera(fast)
    for (let i = 0; i < 240; i++) {
      camSlow = updateCamera(camSlow, slow, 1 / 120)
      camFast = updateCamera(camFast, fast, 1 / 120)
    }
    expect(camFast.zoom).toBeLessThan(camSlow.zoom)
    expect(camFast.zoom).toBeGreaterThanOrEqual(CAM.ZOOM_FAR - 0.01)
  })

  it('shake decays and its offset is deterministic', () => {
    let cam = addShake(createCamera(rider), 10)
    const o1 = shakeOffset(cam)
    const o1again = shakeOffset(cam)
    expect(o1).toEqual(o1again)
    for (let i = 0; i < 120; i++) cam = updateCamera(cam, rider, 1 / 120)
    expect(cam.shakeMag).toBeLessThan(0.5)
  })

  it('is pure - does not mutate its inputs', () => {
    const cam = Object.freeze(createCamera(rider))
    expect(() => updateCamera(cam, rider, 1 / 60)).not.toThrow()
  })
})
