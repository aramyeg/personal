export type TourRect = { top: number; left: number; width: number; height: number }
export type TourSize = { width: number; height: number }
export type TourViewport = { width: number; height: number }

const PADDING = 16

/**
 * Pure viewport-clamped placement for the tour card: prefer right of the
 * target, else left, else below — always clamped to the viewport with a
 * 16px padding so the card never sits under the fold or off-screen.
 */
export function computeTourCardPosition(
  targetRect: TourRect,
  cardSize: TourSize,
  viewport: TourViewport,
  gap = 12,
): { top: number; left: number } {
  const targetRight = targetRect.left + targetRect.width
  const targetBottom = targetRect.top + targetRect.height
  const targetCenterY = targetRect.top + targetRect.height / 2

  const fitsRight = targetRight + gap + cardSize.width <= viewport.width - PADDING
  const fitsLeft = targetRect.left - gap - cardSize.width >= PADDING

  let left: number
  let top: number

  if (fitsRight) {
    left = targetRight + gap
    top = targetCenterY - cardSize.height / 2
  } else if (fitsLeft) {
    left = targetRect.left - gap - cardSize.width
    top = targetCenterY - cardSize.height / 2
  } else {
    left = targetRect.left
    top = targetBottom + gap
  }

  const maxLeft = Math.max(viewport.width - PADDING - cardSize.width, PADDING)
  const maxTop = Math.max(viewport.height - PADDING - cardSize.height, PADDING)

  return {
    left: Math.min(Math.max(left, PADDING), maxLeft),
    top: Math.min(Math.max(top, PADDING), maxTop),
  }
}
