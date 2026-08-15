import type { LabEntry } from '@/lib/labs-manifest'
import styles from './focus-card.module.css'

const STATUS_LABEL: Record<LabEntry['status'], string> = {
  live: 'on display',
  wip: 'in progress',
  attic: 'retired — attic',
}

/** The lean-in placard: what's inside the focused painting. */
export function FocusCard({ lab }: { lab: LabEntry }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <p className={styles.meta}>
        <span>{lab.date}</span>
        <span className={styles.status}>{STATUS_LABEL[lab.status]}</span>
      </p>
      <h2 className={styles.title}>{lab.title}</h2>
      <p className={styles.thesis}>{lab.thesis}</p>
      <p className={styles.action}>click to enter</p>
    </div>
  )
}
