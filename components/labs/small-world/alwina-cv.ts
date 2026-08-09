/**
 * ALWINA'S CREDITS — the one owner of her roles, dates, languages and stack.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS AT ALL
 * ============================================================================
 * Three surfaces print the same facts about a real person's career: the story's
 * wall labels (`alwina-story.ts`), the leaf's colophon (`info-page-spec.ts`), and
 * the plain CV the escape hatch opens (`overlay/cv-document.tsx`). Before this
 * file they were three transcriptions of one pack, and they had ALREADY drifted
 * in a way nobody had noticed: the wall labels print `2013–19` while the
 * colophons print `2013–2019`. Two renderings of one fact is fine; two SOURCES
 * of one fact is how a career gains a year the day somebody edits one of them.
 *
 * So the years are numbers here and the strings are computed. `periodShort` and
 * `periodLong` are the two house styles, and both read the same `from`/`to`.
 *
 * ============================================================================
 * THE ORDER IS THE JOURNEY'S ORDER
 * ============================================================================
 * Index `i` is chapter `i`: the degree first, then the five jobs oldest-first,
 * because that is the order the little world is walked in. A CV reads the other
 * way round — `ROLES_NEWEST_FIRST` is that view, derived rather than retyped, so
 * a new job is added in exactly one place.
 *
 * ============================================================================
 * NOTHING HERE IS INVENTED
 * ============================================================================
 * Every field is the approved round-3 pack (`.superpowers/sdd/task-80-report.md`,
 * §2 "The sheet (final, verbatim)"), decomposed. Where the pack leaves a blank it
 * STAYS blank, and it stayed blank for five rounds: there was no email, because a
 * plausible invented address on a real person's CV is the worst available failure.
 *
 * THE BLANK IS FILLED, AND ONLY BECAUSE ARAM FILLED IT (Task 105). He supplied
 * both, verbatim: `alwinaharutyunyan@gmail.com` and the GitHub handle `alwihar`.
 * They are transcribed exactly as given and nothing about them is derived — the
 * mailto and the profile URL are the scheme in front of the string, the same rule
 * `CONTACT_HREF` has always followed. THE OLD RULE STILL BINDS EVERYTHING ELSE:
 * no other address, handle or profile may appear here unless he supplies it.
 */

export type Credit = {
  /** A job, or the degree. The CV prints them in separate blocks; the walk does not. */
  kind: 'role' | 'education'
  /** The title she held — the thing that goes before the em dash. */
  title: string
  org: string
  from: number
  /** The last year, or `'now'` for the current one. Equal to `from` prints once. */
  to: number | 'now'
}

/** Journey order, oldest first: index `i` is chapter `i`. */
export const CREDITS: readonly Credit[] = [
  {
    kind: 'education',
    title: 'Master of Marketing & Business',
    org: 'Université Jean Moulin Lyon III',
    from: 2013,
    to: 2019,
  },
  { kind: 'role', title: 'Frontend Developer', org: 'IU Networks', from: 2020, to: 2021 },
  { kind: 'role', title: 'UI/UX Engineer', org: 'Sportion', from: 2021, to: 2021 },
  { kind: 'role', title: 'React Developer', org: 'qiibee', from: 2021, to: 2023 },
  { kind: 'role', title: 'Full-stack Software Engineer', org: 'Wooskill', from: 2023, to: 2024 },
  { kind: 'role', title: 'Frontend Engineer', org: 'Sync Design Tech', from: 2025, to: 'now' },
]

/**
 * The years in full — the colophon's and the CV's house style.
 *
 * A single-year credit prints ONE year rather than `2021–2021`, which is the one
 * case that would read as a mistake instead of as a range.
 */
export function periodLong(c: Credit): string {
  if (c.to === 'now') return `${c.from}–now`
  return c.to === c.from ? `${c.from}` : `${c.from}–${c.to}`
}

/** The years abbreviated — the wall label's house style (`2013–19`). */
export function periodShort(c: Credit): string {
  if (c.to === 'now') return `${c.from}–now`
  if (c.to === c.from) return `${c.from}`
  return `${c.from}–${String(c.to).slice(2)}`
}

/**
 * A museum wall label: `Role — Employer, years`.
 *
 * The em dash and the comma are the approved pack's punctuation, and the story's
 * own test pins the last one, so this is the shape rather than a preference.
 */
export const captionFor = (chapter: number): string => {
  const c = CREDITS[chapter]
  return `${c.title} — ${c.org}, ${periodShort(c)}`
}

/** The leaf's colophon, which prints the three parts separated by middots itself. */
export const footerFor = (chapter: number): { role: string; org: string; period: string } => {
  const c = CREDITS[chapter]
  return { role: c.title, org: c.org, period: periodLong(c) }
}

/** A line of the plain CV: `Role — Employer · years`. */
export const creditLine = (c: Credit): string => `${c.title} — ${c.org} · ${periodLong(c)}`

/** The CV's own order: most recent job first. */
export const ROLES_NEWEST_FIRST: readonly Credit[] = CREDITS.filter((c) => c.kind === 'role')
  .slice()
  .reverse()

/** The degree, which the CV prints in its own block under the jobs. */
export const DEGREE: Credit = CREDITS.filter((c) => c.kind === 'education')[0]

/**
 * Who she is, and how to reach her.
 *
 * `says` is the approved voice-C identity line — the one that gets quoted. It is
 * first person with the subject elided, which is how a CV line is normally
 * written and is what the no-third-person gate is written against.
 *
 * TWO NAMES, AND THE SPLIT IS DELIBERATE (Task 103).
 *
 * Aram asked for "Alwina" to read "Alwi" wherever the lab shows it — it is what
 * she is called, and the experience should call her that. Two surfaces do not
 * follow, and the exception was flagged to him rather than assumed:
 *
 *   `name`    — the LEGAL name, and it is used in exactly two places: the plain
 *               CV document (`overlay/cv-document.tsx`, the thing a recruiter
 *               prints or saves) and the route's `<title>`/OpenGraph, which is
 *               the string that travels when the URL is pasted anywhere. A CV
 *               and a link preview that name someone by a nickname are worse
 *               than formal — they are unsearchable.
 *   `display` — what the experience calls her: the chapter-1 sheet's identity
 *               line, and anything else inside the world.
 *   `short`   — the first name alone, for labels that address her.
 *
 * The surname is untouched everywhere it appears. Adding a field rather than
 * flipping `name` is what keeps the exception legible: a future edit that wants
 * the friendly name has to say so.
 */
export const ALWINA = {
  name: 'Alwina Harutyunyan',
  display: 'Alwi Harutyunyan',
  short: 'Alwi',
  says: 'Frontend engineer with opinions about spacing.',
  contact: 'linkedin.com/in/alwina-harutyunyan',
  email: 'alwinaharutyunyan@gmail.com',
  github: 'github.com/alwihar',
} as const

/** The printed contacts, made clickable. Nothing added but the scheme. */
export const CONTACT_HREF = `https://${ALWINA.contact}`
export const EMAIL_HREF = `mailto:${ALWINA.email}`
export const GITHUB_HREF = `https://${ALWINA.github}`

/**
 * NAMED ONCE, AS FACT. The research's story law 5: languages are stated, never
 * counted and never offered as an asset, so this is a list and there is nowhere
 * in the codebase that prints its length.
 */
export const LANGUAGES: readonly string[] = ['English', 'Russian', 'French', 'Armenian']

/** The pack's stack row, verbatim and in its order. Still to be confirmed with her. */
export const STACK: readonly string[] = [
  'React',
  'PHP',
  'AWS',
  'component libraries',
  'real-time dashboards',
  'infrastructure as code',
]
