import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { LineChart } from '@/components/labs/curator/ui/charts/line-chart'
import type { TrafficPoint } from '@/components/labs/curator/analytics-source'

const data: TrafficPoint[] = [
  { date: '2026-07-01', visitors: 100 },
  { date: '2026-07-02', visitors: 140 },
]

const reducedMotionMatchMedia = (query: string) =>
  ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList

describe('LineChart', () => {
  it('renders exactly one annotation line when several labs share a ship date', () => {
    const { container } = render(
      <LineChart
        data={data}
        annotations={[
          { date: '2026-07-01', label: 'Lab A' },
          { date: '2026-07-01', label: 'Lab B' },
        ]}
        title="Traffic"
      />,
    )
    expect(container.querySelectorAll('line')).toHaveLength(1)
  })

  it('disables the draw-in transition under prefers-reduced-motion', async () => {
    const spy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(reducedMotionMatchMedia)
    try {
      const { container } = render(<LineChart data={data} title="Traffic" />)
      const path = container.querySelector('path[stroke="var(--c-blue)"]') as SVGPathElement
      expect(path).not.toBeNull()
      await waitFor(() => {
        expect(path.style.transition).toBe('none')
        expect(path.getAttribute('stroke-dashoffset')).toBe('0')
      })
    } finally {
      spy.mockRestore()
    }
  })
})
