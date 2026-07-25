import { describe, expect, it } from 'vitest'
import { solveTabPiecePose, tabPieceFlatSpan } from '@/components/labs/storybook/book/popup-tabpiece'
import { spreadPageAnglesTilted } from '@/components/labs/storybook/book/popup-mechanics'
import { CHAPTERS } from '@/components/labs/storybook/content'

describe('scratch', () => {
  it('prints legOut/deck world corners vs uv bands at rest', () => {
    const layer = CHAPTERS.flatMap((c) => c.layers).find((l) => l.id === 'ch5-raise-stall') as never as {
      legW: number
      deckD: number
      form: string
    }
    const { thetaL, thetaR } = spreadPageAnglesTilted(0)
    const patches = solveTabPiecePose(layer as never, thetaL, thetaR)
    const span = tabPieceFlatSpan(layer as never)
    const w = (layer.legW ?? 0) / span
    const d = (layer.deckD ?? 0) / span
    const bands: Record<string, [number, number]> = {
      legIn: [0, w],
      deck: [w, w + d],
      legOut: [w + d, 1],
    }
    for (const p of patches) {
      const b = bands[p.face]
      // eslint-disable-next-line no-console
      console.log(
        p.face,
        'band',
        b ? `${b[0].toFixed(3)}..${b[1].toFixed(3)}` : 'n/a',
        'corners(uv-order 0,1,2,3):',
        p.quad.map((c: readonly number[]) => c.map((n) => n.toFixed(3)).join(',')).join(' | ')
      )
    }
    expect(patches.length).toBeGreaterThan(0)
  })
})
