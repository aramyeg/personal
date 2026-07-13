import styles from '../curator.module.css'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`${styles.skeleton} ${className}`} />
}
