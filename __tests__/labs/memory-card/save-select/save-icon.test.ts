import '../../../helpers/canvas-2d'
import { describe, expect, it } from 'vitest'
import { accentFor } from '@/components/labs/memory-card/tokens'
import {
  ICON_FRAMES,
  makeSaveIconFrames,
  saveIconPattern,
} from '@/components/labs/memory-card/lib/save-icon'

const accent = accentFor(0)

/** Count cells that differ between two same-shaped 16x16 grids. */
function diffCount(a: number[][], b: number[][]): number {
  let n = 0
  for (let row = 0; row < a.length; row++) {
    for (let col = 0; col < a[row].length; col++) {
      if (a[row][col] !== b[row][col]) n++
    }
  }
  return n
}

describe('saveIconPattern', () => {
  it('is deterministic for the same seed', () => {
    expect(saveIconPattern('amio-bank')).toEqual(saveIconPattern('amio-bank'))
  })

  it('differs across seeds', () => {
    expect(saveIconPattern('amio-bank')).not.toEqual(saveIconPattern('360dialog'))
  })

  it('returns ICON_FRAMES frames of a 16x16 grid', () => {
    const frames = saveIconPattern('amio-bank')
    expect(frames).toHaveLength(ICON_FRAMES)
    for (const frame of frames) {
      expect(frame).toHaveLength(16)
      for (const row of frame) expect(row).toHaveLength(16)
    }
  })

  it('keeps every cell value within the 0/1/2 palette', () => {
    for (const frame of saveIconPattern('amio-bank')) {
      for (const row of frame) for (const v of row) expect([0, 1, 2]).toContain(v)
    }
  })

  it('mirrors every row left-to-right (symmetric mark)', () => {
    const [base] = saveIconPattern('amio-bank')
    for (const row of base) {
      for (let col = 0; col < 8; col++) expect(row[15 - col]).toBe(row[col])
    }
  })

  it('mutates frames 1 and 2 away from frame 0 by four mirrored cells', () => {
    const [base, frame1, frame2] = saveIconPattern('amio-bank')
    expect(diffCount(base, frame1)).toBe(4)
    expect(diffCount(base, frame2)).toBe(4)
  })
})

describe('makeSaveIconFrames', () => {
  it('draws ICON_FRAMES 64x64 canvases', () => {
    const frames = makeSaveIconFrames('amio-bank', accent)
    expect(frames).toHaveLength(ICON_FRAMES)
    for (const canvas of frames) {
      expect(canvas.width).toBe(64)
      expect(canvas.height).toBe(64)
    }
  })

  it('is pixel-deterministic for the same seed and accent', () => {
    const a = makeSaveIconFrames('amio-bank', accent)[0]
      .getContext('2d')!
      .getImageData(0, 0, 64, 64).data
    const b = makeSaveIconFrames('amio-bank', accent)[0]
      .getContext('2d')!
      .getImageData(0, 0, 64, 64).data
    expect(a).toEqual(b)
  })

  it('paints different pixels for different seeds', () => {
    const a = makeSaveIconFrames('amio-bank', accent)[0]
      .getContext('2d')!
      .getImageData(0, 0, 64, 64).data
    const b = makeSaveIconFrames('360dialog', accent)[0]
      .getContext('2d')!
      .getImageData(0, 0, 64, 64).data
    expect(a).not.toEqual(b)
  })
})
