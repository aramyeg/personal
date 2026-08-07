import { describe, expect, it } from 'vitest'
import { fitBannerText, type MeasureFn } from '@/lib/labs/cloth-pull/paint'
import { CFG } from '@/lib/labs/cloth-pull/config'

/** Fake monospace metrics: width = chars * fontPx * 0.55 */
const measure: MeasureFn = (text, fontPx) => text.length * fontPx * 0.55

const W = 700
const H = 250

describe('fitBannerText', () => {
  it('fits a short message at a large size without dropping words', () => {
    const fit = fitBannerText("Hi! I'm Aram.", W, H, measure)
    expect(fit.lines.join(' ')).toBe("Hi! I'm Aram.")
    expect(fit.lines.length).toBeLessThanOrEqual(2)
    expect(fit.fontPx).toBeGreaterThan(H * 0.2)
    for (const ln of fit.lines) {
      expect(measure(ln, fit.fontPx)).toBeLessThanOrEqual(
        W * (1 - CFG.paint.padX * 2)
      )
    }
  })

  it('wraps a longer message to at most maxLines lines', () => {
    const fit = fitBannerText(
      'a banner hauled in by a very small determined chibi character',
      W,
      H,
      measure
    )
    expect(fit.lines.length).toBeLessThanOrEqual(CFG.paint.maxLines)
    const maxWidth = W * (1 - CFG.paint.padX * 2)
    for (const ln of fit.lines) {
      expect(measure(ln, fit.fontPx)).toBeLessThanOrEqual(maxWidth)
    }
  })

  it('keeps the stacked lines inside the banner height', () => {
    const fit = fitBannerText(
      'quite a lot of words to stack into the cloth here today',
      W,
      H,
      measure
    )
    expect(fit.fontPx * CFG.paint.lineHeight * fit.lines.length).toBeLessThanOrEqual(
      H * 0.8 + 1e-9
    )
  })

  it('chooses a larger size for a shorter message', () => {
    const short = fitBannerText('Hi!', W, H, measure)
    const long = fitBannerText(
      'the same banner but carrying a much wordier message on it',
      W,
      H,
      measure
    )
    expect(short.fontPx).toBeGreaterThan(long.fontPx)
  })

  it('degrades gracefully when even the floor size cannot wrap cleanly', () => {
    const fit = fitBannerText(
      'antidisestablishmentarianismandthensomemorecharactersforgoodmeasureplusafewextra',
      120,
      40,
      measure
    )
    expect(fit.fontPx).toBeGreaterThanOrEqual(CFG.paint.minFontPx)
    expect(fit.lines.length).toBeGreaterThan(0)
  })

  it('collapses whitespace runs and trims the message', () => {
    const fit = fitBannerText('   Hi!    I\'m   Aram.  ', W, H, measure)
    expect(fit.lines.join(' ')).toBe("Hi! I'm Aram.")
  })
})
