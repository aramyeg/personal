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
 * The overlay joins the page turn's choreography (see the SpreadOverlay
 * component + turn-events.ts): the outgoing text exits as the turn begins and
 * the incoming text staggers in a beat before the page settles, rather than
 * flat-fading in after the motion stops. All copy is
 * real facts pulled from `content.ts` / `satchel-items.ts` /
 * `lib/constants.ts` — nothing hardcoded here beyond structural glue
 * (kickers, the colophon line) and decorative punctuation spans
 * (`decorateText`, which only re-wraps characters already present in the
 * source strings — it never changes them).
 */

import { useEffect, useState } from 'react'
import { skills } from '@/data'
import { siteConfig, socialLinks } from '@/lib/constants'
import { useArtIds } from '../art-manifest'
import { useSpreadChoreography } from './use-spread-choreography'
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
  // Manifest-gated like every other art consumer: an <img> for ungenerated
  // art would 404 in the console even with onError handled.
  const artIds = useArtIds()
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
                {artIds?.has(item.assetId) && (
                  <>
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
                  </>
                )}
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

/**
 * The overlay JOINS the page turn's choreography instead of appending its
 * text after it (E-G4 item 5). The shared choreography hook
 * (use-spread-choreography.ts) tracks `displaySpread` — the spread the text
 * should show, synced to the turn's land cue (decoupled from the store's
 * `spread`, which only commits at t=1) — plus the `exiting` phase:
 *
 *   - a turn arms → `exiting`: the visible (outgoing) spread's text lifts +
 *     fades away as the page begins to turn.
 *   - the land cue fires → `displaySpread` swaps to the incoming spread: the
 *     panel remounts (keyed by `displaySpread`) so its CSS entrance replays,
 *     staggering kicker → flourish → title → narration → plaque up into place
 *     a beat before the page settles — the turn DELIVERS the words.
 */
export function SpreadOverlay() {
  // Shared with the nav label (use-spread-choreography.ts) so both text
  // surfaces swap on the same land cue rather than the overlay leading.
  const { displaySpread, exiting, frozenTurn } = useSpreadChoreography()
  const [expanded, setExpanded] = useState(false)

  // A fresh spread always starts collapsed (portrait drawer) — otherwise the
  // previous page's fully-open drawer would keep covering the newly turned
  // scene the instant it lands.
  useEffect(() => setExpanded(false), [displaySpread])

  const content = contentForSpread(displaySpread)
  // Hidden on the closed cover (spread 0 has no text, and the portrait
  // "unfold the tale" toggle must not dangle over the shut book) and over a
  // frozen benchmark pose. Everything else is choreographed, never flat-faded.
  const hidden = frozenTurn || displaySpread === 0

  return (
    <div
      className="sb-overlay"
      data-expanded={expanded}
      data-sb-phase={exiting ? 'exiting' : 'resting'}
      style={hidden ? { opacity: 0 } : undefined}
    >
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
      {/* Keyed by the shown spread so a landing REMOUNTS the panel, replaying
          the staggered CSS entrance (storybook-overlay.css) exactly once per
          arrival — a plain re-render (e.g. the drawer toggle) never replays it. */}
      <div id="sb-drawer-panel" key={displaySpread}>
        {content}
      </div>
    </div>
  )
}
