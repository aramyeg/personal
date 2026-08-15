import { describe, expect, it } from 'vitest'
import { parseMetric, formatMetricValue } from '@/components/labs/memory-card/save-select/metric'

describe('parseMetric', () => {
  it('splits a thousands-separated count from its unit and label', () => {
    expect(parseMetric('50,000+ businesses')).toMatchObject({
      value: 50000,
      decimals: 0,
      suffix: '+',
      label: 'businesses',
    })
  })

  it('keeps a letter-scaled unit attached to the number', () => {
    expect(parseMetric('4B+ messages handled')).toMatchObject({
      value: 4,
      suffix: 'B+',
      label: 'messages handled',
    })
  })

  it('reads a decimal value and its decimal count', () => {
    const parsed = parseMetric('4.7★ rating')
    expect(parsed.value).toBe(4.7)
    expect(parsed.decimals).toBe(1)
    expect(parsed.suffix).toBe('★')
    expect(parsed.label).toBe('rating')
  })

  it('treats a leading number with a trailing space as no suffix', () => {
    expect(parseMetric('2 years development')).toMatchObject({
      value: 2,
      suffix: '',
      label: 'years development',
    })
  })

  it('returns a null value for a metric with no leading number', () => {
    expect(parseMetric('Ongoing development')).toMatchObject({
      value: null,
      label: 'Ongoing development',
    })
  })
})

describe('formatMetricValue', () => {
  it('rounds and thousands-groups integers', () => {
    expect(formatMetricValue(50000, 0)).toBe('50,000')
    expect(formatMetricValue(4999.6, 0)).toBe('5,000')
  })

  it('keeps the requested decimal places', () => {
    expect(formatMetricValue(4.7, 1)).toBe('4.7')
    expect(formatMetricValue(2.34, 2)).toBe('2.34')
  })
})
