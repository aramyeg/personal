/**
 * Default state of the `@panel` slot: nothing over the screen. Rendered whenever
 * no save-overlay route matches — a fresh visit, the standalone save page on a
 * hard load, or after the overlay is dismissed with router.back().
 */
export default function PanelDefault() {
  return null
}
