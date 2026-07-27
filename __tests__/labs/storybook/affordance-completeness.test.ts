/**
 * AFFORDANCE COMPLETENESS (E3 SP-1) — the gate that fails when a NEW family
 * ships without the four legs.
 *
 * The affordance system is four shared helpers, and every one of them is opt-in
 * per layer: hover truth (handle-hover.ts), the hover glow, the tap detector
 * (use-handle-tap.ts) and the click nudge (handle-nudge.ts). Nothing enforced
 * that a family used them. The dispatch line proved the cost: it shipped with
 * hover and glow and NO tap detector at all, so the one gesture every blind
 * reader tries first — press, release, look — answered nothing on the piece one
 * of them called "the one thing on the page that behaves like a paper toy". No
 * suite noticed, because every suite tested the helpers, not their adoption.
 *
 * WHAT THIS GATE CAN AND CANNOT SEE. It reads LAYER SOURCE TEXT (the idiom
 * compact-layout.test.ts uses for the media-query seam). That proves the WIRING
 * EXISTS — the import, the handler, the call — and nothing about whether it
 * fires at runtime. The complements are:
 *   - handle-drag-regression.test.ts — the pipeline actually moves paper,
 *   - hover-truth.test.ts           — markHandleHovered's guard answers again,
 *   - affordance.test.ts            — the glow, the pulse and the beckon clock.
 * A family can satisfy this file and still be broken; a family that FAILS it is
 * missing a leg outright, which is the defect class this exists to catch.
 *
 * The family list is DERIVED, never typed: every mech in content.ts whose layer
 * file takes a grab (`beginGrab`) is audited, so a new family is covered the day
 * its content lands.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BECKON_EXCLUDED_FAMILIES,
  FAMILY_RANK,
  primaryPlayableChannel,
} from '@/components/labs/storybook/book/handle-beckon'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

const BOOK_DIR = join(process.cwd(), 'components/labs/storybook/book')
const layerPath = (family: string) => join(BOOK_DIR, `popup-${family}-layer.tsx`)

/** Source with comments removed: a family must not be able to satisfy a leg by
 *  writing its name in a postmortem (these files quote their own history at
 *  length, which is exactly where that belongs). */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const layerSource = (family: string): string => code(readFileSync(layerPath(family), 'utf8'))

/** Every layer in the book, spread index included. */
function allLayers(): { layer: SceneLayer; spreadIndex: number }[] {
  const out: { layer: SceneLayer; spreadIndex: number }[] = []
  for (let s = 0; s < SPREAD_COUNT; s++) {
    for (const layer of popupContentForSpread(s)?.layers ?? []) out.push({ layer, spreadIndex: s })
  }
  return out
}

/**
 * The families that own a grabbable, derived rather than listed: a mech that
 * ships content AND has a layer file that calls `beginGrab` is a family a reader
 * can take hold of, and therefore a family that owes all four legs.
 *
 * `knobtower` is added by hand for the one reason handle-drag-regression.test.ts
 * adds it: its family code is live and reachable from the spread dispatcher but
 * no spread ships one yet, and a family is not exempt from the laws because the
 * scene lanes have not used it.
 */
function grabbableFamilies(): string[] {
  const families = new Set<string>(['knobtower'])
  for (const { layer } of allLayers()) {
    const family = layer.mech
    if (families.has(family)) continue
    if (!existsSync(layerPath(family))) continue
    if (/\bbeginGrab\(/.test(layerSource(family))) families.add(family)
  }
  return [...families].sort()
}

const FAMILIES = grabbableFamilies()

/** The body of `const <name> = (...) => { ... }`, brace-matched. Empty string if
 *  the handler is not declared at all — which reads as "leg missing", correctly. */
function handlerBody(src: string, name: string): string {
  const decl = src.indexOf(`const ${name} = `)
  if (decl < 0) return ''
  const open = src.indexOf('{', src.indexOf('=>', decl))
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1)
  }
  return ''
}

/**
 * THE CHANNEL EACH FAMILY READS ITS NUDGE ON, and the proof in its own source.
 *
 * The beckon fires `pulseHandle(channel)`, and the layer reads the excursion
 * back with `nudgeOffset(channel, ...)`. Those two strings must be the SAME
 * string or the invitation lands on a channel nobody renders — a silent failure
 * that looks exactly like a working beckon from every angle except the reader's.
 * Most families key on the layer id; the ones that key per sub-part (a lift
 * flap's doors, the swarm's stir tab, the dispatch line's send stroke) do not.
 *
 * A family with no entry here fails below by name: adding one is how a new
 * family declares where its pulse is read.
 */
const ON_LAYER_ID: RegExp[] = [/nudgeOffset\(\s*layer\.id\b/]

const NUDGE_CHANNEL: Readonly<
  Record<string, { channel: (id: string) => string; proofs: RegExp[] }>
> = {
  liftflap: {
    // The beckon offers door 0, the leaf nearest the reader's eye.
    channel: (id) => `${id}~0`,
    proofs: [
      /const doorChannel = \(layerId: string, k: number\): string => `\$\{layerId\}~\$\{k\}`/,
      /nudgeOffset\(\s*doorChannel\(/,
    ],
  },
  swarmarc: {
    channel: (id) => `${id}~stir`,
    proofs: [/const stirChannel = `\$\{layer\.id\}~stir`/, /nudgeOffset\(\s*stirChannel\b/],
  },
  dispatchline: {
    channel: (id) => `${id}~send`,
    proofs: [
      /const sendChannel = `\$\{layer\.id\}~send`/,
      // The excursion is applied in the one reader the rider quad and its
      // touch-slop pad share, and that reader is handed the send channel.
      /function shownSend\([\s\S]*?nudgeOffset\(\s*channel\b/,
      /shownSend\(sendChannel\b/,
    ],
  },
  stripflap: { channel: (id) => id, proofs: ON_LAYER_ID },
  tabpiece: { channel: (id) => id, proofs: ON_LAYER_ID },
  dissolve: { channel: (id) => id, proofs: ON_LAYER_ID },
  volvelle: { channel: (id) => id, proofs: ON_LAYER_ID },
  keepwinch: { channel: (id) => id, proofs: ON_LAYER_ID },
  knobtower: { channel: (id) => id, proofs: ON_LAYER_ID },
  keepsake: { channel: (id) => id, proofs: ON_LAYER_ID },
}

describe('affordance completeness — every grabbable family carries all four legs', () => {
  it('audits every family the book can hand a reader', () => {
    // Mirrors handle-drag-regression.test.ts's own coverage guard: a family that
    // stops calling beginGrab drops silently out of a derived list, so the
    // shipped set is named once, here, and nowhere else.
    expect(FAMILIES).toEqual(
      [
        'dispatchline',
        'dissolve',
        'keepsake',
        'keepwinch',
        'knobtower',
        'liftflap',
        'stripflap',
        'swarmarc',
        'tabpiece',
        'volvelle',
      ].sort()
    )
  })

  for (const family of FAMILIES) {
    describe(family, () => {
      const src = layerSource(family)
      const where = `popup-${family}-layer.tsx`

      it('asks for hover on every MOVE, not only on entry', () => {
        // R-2: onPointerOver fires once per entry and the write is refused while
        // the book boots, turns or holds another grab. A refused write is never
        // retried, so the cursor lies to a reader whose hand is already there.
        expect(src, `${family}: ${where} does not import markHandleHovered`).toContain(
          'markHandleHovered'
        )
        expect(
          handlerBody(src, 'onPointerMove'),
          `${family}: ${where} has no onPointerMove that calls markHandleHovered — hover is ` +
            `written on entry only, so a parked pointer reads dead until the hand moves off and back`
        ).toContain('markHandleHovered')
        expect(
          handlerBody(src, 'onPointerOver'),
          `${family}: ${where} has no onPointerOver that calls markHandleHovered`
        ).toContain('markHandleHovered')
        expect(
          handlerBody(src, 'onPointerOut'),
          `${family}: ${where} has no onPointerOut that clears hover — the cursor would stay ` +
            `grab after the hand has left the piece`
        ).toContain('clearHover')
      })

      it('attaches those handlers to the object it renders', () => {
        for (const prop of ['onPointerMove', 'onPointerOver', 'onPointerOut']) {
          expect(
            src,
            `${family}: ${where} declares ${prop} but never binds it in JSX`
          ).toContain(`${prop}={${prop}}`)
        }
      })

      it('answers a hover with light (the glow leg)', () => {
        expect(src, `${family}: ${where} never calls stepHoverGlow`).toMatch(/\bstepHoverGlow\(/)
        expect(
          src,
          `${family}: ${where} steps a glow weight but never applies it with applyHandleGlow`
        ).toMatch(/\bapplyHandleGlow\(/)
      })

      it('detects a tap and answers it (the press-state leg)', () => {
        const held = /const (\w+) = useHandleTap\(\)/.exec(src)
        expect(
          held,
          `${family}: ${where} never calls useHandleTap — a click on this piece answers nothing, ` +
            `and most readers click before they drag`
        ).not.toBeNull()
        const tap = (held as RegExpExecArray)[1]
        for (const call of ['begin', 'track', 'end'] as const) {
          expect(
            src,
            `${family}: ${where} holds a tap detector but never calls ${tap}.${call}() — ` +
              `${call === 'begin' ? 'onPointerDown must seed it with the drive the grab starts from' : call === 'track' ? 'onPointerMove must feed it the drive it just wrote' : 'the release path must fire the pulse'}`
          ).toContain(`${tap}.${call}(`)
        }
      })

      it('renders the click nudge (the excursion leg)', () => {
        expect(
          src,
          `${family}: ${where} fires a tap pulse that nothing reads — apply nudgeOffset (or ` +
            `readNudgePulse) at RENDER time in the reader every consumer of the drive shares, ` +
            `never written back to the channel`
        ).toMatch(/\b(nudgeOffset|readNudgePulse)\(/)
      })

      it('declares where its pulse is read, and reads it there', () => {
        const entry = NUDGE_CHANNEL[family]
        expect(
          entry,
          `${family}: no NUDGE_CHANNEL entry — a new grabbable family must say which channel it ` +
            `reads its nudge on, or the idle beckon can pulse a channel nobody renders`
        ).toBeDefined()
        for (const proof of entry.proofs) {
          expect(
            proof.test(src),
            `${family}: ${where} does not read its nudge on the channel this gate expects ` +
              `(${entry.channel('<id>')}); missing ${proof}`
          ).toBe(true)
        }
      })
    })
  }
})

/**
 * BECKON ELIGIBILITY — the spread-level half of the same question.
 *
 * A family can carry all four legs and still be invisible to a first-time
 * reader: the idle invitation picks by FAMILY RANK, and an unranked family is
 * skipped. The dispatch line was unranked, so the one spread whose headline
 * playable is the trolley offered nothing at all. An absence and a deliberate
 * exclusion look identical in a rank table, which is why keepsake's exclusion is
 * now an explicit set (handle-beckon.ts).
 */
describe('beckon eligibility — no grabbable family is silently unranked', () => {
  const eligible = FAMILIES.filter((f) => !BECKON_EXCLUDED_FAMILIES.has(f))

  it('ranks every grabbable family, or excludes it on purpose', () => {
    for (const family of FAMILIES) {
      expect(
        FAMILY_RANK[family] !== undefined || BECKON_EXCLUDED_FAMILIES.has(family),
        `${family} is grabbable but is neither ranked in FAMILY_RANK nor listed in ` +
          `BECKON_EXCLUDED_FAMILIES — a spread whose only playable is a ${family} offers a ` +
          `reader no invitation at all. Rank it, or exclude it and say why.`
      ).toBe(true)
    }
  })

  it('carries no dead ranks', () => {
    for (const family of Object.keys(FAMILY_RANK)) {
      expect(
        FAMILIES,
        `FAMILY_RANK ranks ${family}, which is not a grabbable family in the book`
      ).toContain(family)
    }
  })

  it('never both ranks and excludes a family', () => {
    for (const family of BECKON_EXCLUDED_FAMILIES) {
      expect(FAMILY_RANK[family], `${family} is excluded AND ranked`).toBeUndefined()
    }
  })

  it('offers an invitation on every spread that has an eligible playable', () => {
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const layers = popupContentForSpread(s)?.layers ?? []
      const playables = layers.filter((l) => eligible.includes(l.mech))
      const channel = primaryPlayableChannel(s)
      if (playables.length === 0) {
        expect(channel, `spread ${s} has no eligible playable but beckoned ${channel}`).toBeNull()
        continue
      }
      expect(
        channel,
        `spread ${s} ships ${playables.map((l) => l.mech).join(', ')} and beckons nothing`
      ).not.toBeNull()
      // ...and on a channel its owner's layer actually reads its nudge on, so the
      // pulse reaches a piece rather than an unrendered string.
      const owner = playables.find((l) => NUDGE_CHANNEL[l.mech]?.channel(l.id) === channel)
      expect(
        owner,
        `spread ${s} beckoned ${channel}, which is not the nudge channel of any playable on it ` +
          `(${playables.map((l) => NUDGE_CHANNEL[l.mech]?.channel(l.id)).join(', ')})`
      ).toBeDefined()
    }
  })

  it('never beckons an excluded family', () => {
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const channel = primaryPlayableChannel(s)
      if (channel === null) continue
      const owner = (popupContentForSpread(s)?.layers ?? []).find(
        (l) => channel === l.id || channel.startsWith(`${l.id}~`)
      )
      expect(
        BECKON_EXCLUDED_FAMILIES.has(owner?.mech ?? ''),
        `spread ${s} beckoned a ${owner?.mech} — a one-way door must not invite a first touch`
      ).toBe(false)
    }
  })
})
