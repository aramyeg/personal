'use client'

/**
 * The book's real HTML text layer: narration, plaques, the title/satchel/end
 * pages, tracking the WebGL spread's screen-space rect (`pageRect`, written
 * by `book/page-rect-reporter.tsx`). Absolutely positioned over the canvas,
 * pointer-events none except its own interactive children (the wax seal and
 * sigil links), faded out while a turn is in flight or on the closed cover.
 * All copy is real facts pulled from `content.ts` / `satchel-items.ts` /
 * `lib/constants.ts` — nothing hardcoded here beyond structural glue.
 */

import type { CSSProperties } from 'react'
import { skills } from '@/data'
import { siteConfig, socialLinks } from '@/lib/constants'
import { useStorybookStore } from '../store'
import {
  BOOK_SUBTITLE,
  BOOK_TITLE,
  END_CLOSING_LINE,
  SATCHEL_HEADING,
  SATCHEL_INTRO,
  SPREAD_COUNT,
  TITLE_OPENING_LINE,
  chapterForSpread,
  experienceFor,
  type Chapter,
} from '../content'
import { SATCHEL_ITEMS, satchelSkill } from '../satchel-items'

const FEATURED_SKILL_NAMES = new Set(SATCHEL_ITEMS.map((item) => item.skillName))
const REMAINING_SKILLS = skills.filter((skill) => !FEATURED_SKILL_NAMES.has(skill.name))

function TitleContent() {
  return (
    <div className="sb-overlay-content sb-overlay-content--title">
      <h1 className="sb-chapter-title sb-title-hero">{BOOK_TITLE}</h1>
      <p className="sb-book-subtitle">{BOOK_SUBTITLE}</p>
      <p className="sb-chapter-kicker sb-byline">
        written &amp; illustrated in paper · {siteConfig.name}
      </p>
      <p className="sb-narration sb-no-dropcap sb-opening-line">{TITLE_OPENING_LINE}</p>
    </div>
  )
}

function ChapterContent({ chapter }: { chapter: Chapter }) {
  const exp = experienceFor(chapter)
  return (
    <div className="sb-overlay-content sb-overlay-content--chapter">
      <div className="sb-chapter-col sb-chapter-col--narration">
        <p className="sb-chapter-kicker">{chapter.kicker}</p>
        <h2 className="sb-chapter-title">
          {chapter.numeral}. {chapter.title}
        </h2>
        <p className="sb-narration">{chapter.narration}</p>
      </div>
      <div className="sb-chapter-col sb-chapter-col--plaque">
        <div className="sb-plaque">
          <p className="sb-plaque-facts">
            <strong>{exp.company}</strong> · {exp.role} · {exp.location} · {exp.period}
          </p>
          <ul className="sb-plaque-highlights">
            {exp.highlights.slice(0, 3).map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SatchelContent() {
  return (
    <div className="sb-overlay-content sb-overlay-content--satchel">
      <div className="sb-satchel-head">
        <h2 className="sb-chapter-title">{SATCHEL_HEADING}</h2>
        <p className="sb-narration sb-no-dropcap">{SATCHEL_INTRO}</p>
      </div>
      <ul className="sb-satchel-grid">
        {SATCHEL_ITEMS.map((item) => {
          const skill = satchelSkill(item)
          return (
            <li key={item.assetId} className="sb-satchel-item">
              {/* eslint-disable-next-line @next/next/no-img-element -- art
                  ships incrementally; onError hides the placeholder gap. */}
              <img
                src={`/labs/storybook/art/${item.assetId}.webp`}
                alt=""
                className="sb-satchel-img"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div className="sb-satchel-tag">
                <p className="sb-satchel-name">{item.itemName}</p>
                <p className="sb-chapter-kicker">
                  {skill.name} · {skill.years} yrs · {skill.level}
                </p>
                <p className="sb-satchel-blurb">{item.blurb}</p>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="sb-chapter-kicker sb-satchel-more">
        also in the bags: {REMAINING_SKILLS.map((skill) => skill.name).join(' · ')}
      </p>
    </div>
  )
}

function EndContent() {
  return (
    <div className="sb-overlay-content sb-overlay-content--end">
      <p className="sb-narration sb-no-dropcap">{END_CLOSING_LINE}</p>
      <div className="sb-end-actions">
        <a
          href={`mailto:${siteConfig.email}`}
          className="sb-wax-seal"
          aria-label="Send a raven"
          data-sb-hover
        >
          <span aria-hidden="true">A</span>
        </a>
        <ul className="sb-sigil-links">
          {socialLinks.map((link) => (
            <li key={link.name}>
              <a
                href={link.url}
                className="sb-sigil-link"
                target="_blank"
                rel="noreferrer"
                data-sb-hover
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function contentForSpread(spread: number) {
  if (spread === 1) return <TitleContent />
  const chapter = chapterForSpread(spread)
  if (chapter) return <ChapterContent chapter={chapter} />
  if (spread === 8) return <SatchelContent />
  if (spread === SPREAD_COUNT - 1) return <EndContent />
  return null
}

export function SpreadOverlay() {
  const spread = useStorybookStore((s) => s.spread)
  const turning = useStorybookStore((s) => s.turning)
  const pageRect = useStorybookStore((s) => s.pageRect)

  const faded = turning !== null || spread === 0
  const style: CSSProperties = pageRect
    ? {
        left: pageRect.left,
        top: pageRect.top,
        width: pageRect.width,
        height: pageRect.height,
        opacity: faded ? 0 : 1,
      }
    : { opacity: 0 }

  return (
    <div className="sb-overlay" style={style}>
      {contentForSpread(spread)}
    </div>
  )
}
