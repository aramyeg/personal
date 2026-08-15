/**
 * Metric parsing for the story band's counters. A project metric is a short
 * human string like `50,000+ businesses`, `4B+ messages handled`, `4.7★ rating`
 * or `Ongoing development`. This splits the leading number (with its unit
 * suffix) from the trailing label so the band can count the number up and print
 * the label beside it; a metric with no leading number is returned label-only so
 * the band can render it as an animated bar instead of a counter.
 *
 * Pure string work, no React — unit-testable on its own.
 */

export type ParsedMetric = {
  /** Leading numeric value, or null when the metric is plain text. */
  value: number | null
  /** Decimal places in the source number (so `4.7` counts to one decimal). */
  decimals: number
  /** Unit glued to the number: `+`, `M+`, `B+`, `K+`, `★`, `%`, … */
  suffix: string
  /** The human label after the number (or the whole string when text-only). */
  label: string
  /** The original metric string, untouched. */
  raw: string
}

/** Number + immediately-attached unit + label: `50,000+ businesses`. */
const METRIC_RE = /^([\d,]+(?:\.\d+)?)([^\s]*)\s*(.*)$/

export function parseMetric(raw: string): ParsedMetric {
  const trimmed = raw.trim()
  const match = METRIC_RE.exec(trimmed)
  if (!match) {
    return { value: null, decimals: 0, suffix: '', label: trimmed, raw }
  }
  const [, numText, suffix, label] = match
  const value = Number(numText.replace(/,/g, ''))
  if (!Number.isFinite(value)) {
    return { value: null, decimals: 0, suffix: '', label: trimmed, raw }
  }
  const dot = numText.indexOf('.')
  const decimals = dot === -1 ? 0 : numText.length - dot - 1
  return { value, decimals, suffix, label: label.trim(), raw }
}

/** Format a (possibly mid-count) value the way its source number was written. */
export function formatMetricValue(value: number, decimals: number): string {
  if (decimals > 0) return value.toFixed(decimals)
  return Math.round(value).toLocaleString('en-US')
}
