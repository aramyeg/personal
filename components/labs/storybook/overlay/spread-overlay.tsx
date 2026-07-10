'use client'

/**
 * The book's real HTML text layer: narration, plaques, the title/satchel/end
 * pages. The book itself is always screen-centered (camera + book both sit
 * on the x=0 axis — see book-scene.tsx), so on desktop this renders as two
 * fixed side columns flanking it (`.sb-col-left` / `.sb-col-right`, plus a
 * centered `.sb-title-panel` for the title spread) rather than tracking the
 * spread's on-screen rect: no projection math, no `pageRect` in the store.
 * `#sb-drawer-panel` is `display: contents` (storybook-overlay.css) so those
 * elements land as direct children of `.sb-overlay` — a grid on desktop
 * (real side columns) and a flex column in portrait (a bottom drawer,
 * storybook-responsive.css) — without two different component trees.
 *
 * Each column carries a `.sb-drawer-header` (kicker + flourish + title —
 * always visible) and one or more `.sb-drawer-body` blocks (narration,
 * plaque, satchel grid, colophon — collapsed to nothing in the portrait
 * drawer until `.sb-drawer-toggle` expands it; always visible on desktop).
 * Faded out while a turn is in flight or on the closed cover. All copy is
 * real facts pulled from `content.ts` / `satchel-items.ts` /
 * `lib/constants.ts` — nothing hardcoded here beyond structural glue
 * (kickers, the colophon line) and decorative punctuation spans
 * (`decorateText`, which only re-wraps characters already present in the
 * source strings — it never changes them).
 */

import { useEffect, useState } from 'react'
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
import { decorateText, Fleuron, FlourishDivider, Hairline } from './ornaments'

const FEATURED_SKILL_NAMES = new Set(SATCHEL_ITEMS.map((item) => item.skillName))
const REMAINING_SKILLS = skills.filter((skill) => !FEATURED_SKILL_NAMES.has(skill.name))
const COLOPHON = `written & illustrated in paper · ${siteConfig.name} · MMXXVI`

function TitleContent() {
  return (
    <div className="sb-title-panel">
      <Hairline />
      <div className="sb-drawer-header">
        <p className="sb-chapter-kicker">the tale begins</p>
        <FlourishDivider />
        <h1 className="sb-chapter-title sb-title-hero">{BOOK_TITLE}</h1>
      </div>
      <div className="sb-drawer-body">
        <p className="sb-book-subtitle">{BOOK_SUBTITLE}</p>
        <p className="sb-chapter-kicker sb-byline">
          written &amp; illustrated in paper · {siteConfig.name}
        </p>
        <p className="sb-narration sb-no-dropcap sb-opening-line">
          {decorateText(TITLE_OPENING_LINE)}
        </p>
        <Hairline />
      </div>
    </div>
  )
}

function ChapterContent({ chapter }: { chapter: Chapter }) {
  const exp = experienceFor(chapter)
  return (
    <>
      <div className="sb-col-left">
        <Hairline />
        <div className="sb-drawer-header">
          <p className="sb-chapter-kicker">{chapter.kicker}</p>
          <FlourishDivider />
          <h2 className="sb-chapter-title">
            {chapter.numeral}. {chapter.title}
          </h2>
        </div>
        <div className="sb-drawer-body">
          <p className="sb-narration sb-narration--illuminated">{decorateText(chapter.narration)}</p>
          <Fleuron />
          <Hairline />
        </div>
      </div>
      <div className="sb-col-right sb-drawer-body">
        <Hairline />
        <div className="sb-plaque sb-plaque--dark">
          <p className="sb-plaque-facts">
            <strong>{exp.company}</strong> · {exp.role} · {exp.location} · {exp.period}
          </p>
          <ul className="sb-plaque-highlights">
            {exp.highlights.slice(0, 3).map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>
        <Hairline />
      </div>
    </>
  )
}

function SatchelContent() {
  return (
    <>
      <div className="sb-col-left">
        <Hairline />
        <div className="sb-drawer-header">
          <p className="sb-chapter-kicker">the hero&rsquo;s tools</p>
          <FlourishDivider />
          <h2 className="sb-chapter-title">{SATCHEL_HEADING}</h2>
        </div>
        <div className="sb-drawer-body">
          <p className="sb-narration sb-no-dropcap">{decorateText(SATCHEL_INTRO)}</p>
          <Hairline />
        </div>
      </div>
      <div className="sb-col-right sb-drawer-body">
        <Hairline />
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
                    {skill.name} · {skill.years} yrs
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
        <Hairline />
      </div>
    </>
  )
}

function EndContent() {
  return (
    <>
      <div className="sb-col-left">
        <Hairline />
        <div className="sb-drawer-header">
          <p className="sb-chapter-kicker">the final page</p>
          <FlourishDivider />
          <h2 className="sb-chapter-title">The End</h2>
        </div>
        <div className="sb-drawer-body">
          <p className="sb-narration sb-no-dropcap">{decorateText(END_CLOSING_LINE)}</p>
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
          <Hairline />
        </div>
      </div>
      <div className="sb-col-right sb-drawer-body">
        <Hairline />
        <p className="sb-colophon">{COLOPHON}</p>
        <Hairline />
      </div>
    </>
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
  const [expanded, setExpanded] = useState(false)

  // A fresh spread always starts collapsed (portrait drawer) — otherwise the
  // previous page's fully-open drawer would keep covering the newly turned
  // scene the instant it lands.
  useEffect(() => setExpanded(false), [spread])

  const faded = turning !== null || spread === 0
  const content = contentForSpread(spread)

  return (
    <div className="sb-overlay" style={{ opacity: faded ? 0 : 1 }} data-expanded={expanded}>
      <button
        type="button"
        className="sb-drawer-toggle"
        aria-expanded={expanded}
        aria-controls="sb-drawer-panel"
        onClick={() => setExpanded((v) => !v)}
        data-sb-hover
      >
        <span>{expanded ? 'fold it away' : 'unfold the tale'}</span>
        <span className="sb-drawer-toggle-glyph" aria-hidden="true">
          {expanded ? '⌃' : '⌄'}
        </span>
      </button>
      <div id="sb-drawer-panel">{content}</div>
    </div>
  )
}
