import styles from './curtain.module.css'

export const CONTROLS: Array<[string, string]> = [
  ['Click', 'step in — locks the cursor'],
  ['W A S D', 'walk the halls'],
  ['Mouse', 'look around'],
  ['Shift', 'run'],
  ['Space', 'jump'],
  ['Click a painting', 'enter the work'],
  ['Esc', 'release the cursor'],
]

/** The printed card of controls, shown on the curtain and behind the ? button. */
export function VisitorGuide() {
  return (
    <div className={styles.guide}>
      <p className={styles.guideEyebrow}>Museum of Experiments</p>
      <h2 className={styles.guideTitle}>Visitor&rsquo;s Guide</h2>
      <dl className={styles.guideList}>
        {CONTROLS.map(([key, what]) => (
          <div key={key} className={styles.guideRow}>
            <dt>{key}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
