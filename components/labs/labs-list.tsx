import type { ReactNode } from 'react'
import Link from 'next/link'
import { atticLabs, hallLabs, type LabEntry } from '@/lib/labs-manifest'
import { siteConfig, socialLinks } from '@/lib/constants'
import styles from './catalogue.module.css'

function CatalogueCard({ lab, showRetrospective }: { lab: LabEntry; showRetrospective?: boolean }) {
  return (
    <Link href={lab.href ?? `/labs/${lab.slug}`} className={styles.card}>
      <span className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/labs/${lab.slug}/poster.jpg`}
          alt={`${lab.title} poster`}
          width={768}
          height={1024}
          loading="lazy"
        />
      </span>
      <span className={styles.placard}>
        <span className={styles.placardTitle}>{lab.title}</span>
        <span className={styles.placardDate}>{lab.date}</span>
        {lab.status === 'wip' && <span className={styles.placardWip}>in progress</span>}
        <span className={styles.placardThesis}>{lab.thesis}</span>
      </span>
      {showRetrospective && lab.retrospective && (
        <span className={styles.retrospective}>{lab.retrospective}</span>
      )}
    </Link>
  )
}

/** The museum's printed program: the catalogue list view and crawler path. */
export function LabsList({ enterAction }: { enterAction?: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.masthead}>
          <p className={styles.eyebrow}>Museum of Experiments</p>
          <h1 className={styles.name}>{siteConfig.name}</h1>
          <p className={styles.role}>{siteConfig.title}</p>
          <p className={styles.intro}>
            One portfolio, many design systems. Every room re-skins the same
            content — my actual work and experience — in a completely different
            visual identity. The permanent collection grows regularly.
          </p>
          <nav className={styles.mastheadLinks} aria-label="Primary">
            <Link href="/classic-claude">Enter the classic site</Link>
            {socialLinks.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            ))}
          </nav>
          {enterAction && <div className={styles.enterSlot}>{enterAction}</div>}
        </header>

        <div className={styles.grid}>
          {hallLabs.map((lab) => (
            <CatalogueCard key={lab.slug} lab={lab} />
          ))}
        </div>

        {atticLabs.length > 0 && (
          <section className={styles.attic}>
            <h2 className={styles.atticHeading}>failed experiments</h2>
            <p className={styles.atticSub}>
              Retired iterations, kept playable. The verdicts are part of the work.
            </p>
            <div className={styles.grid}>
              {atticLabs.map((lab) => (
                <CatalogueCard key={lab.slug} lab={lab} showRetrospective />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
