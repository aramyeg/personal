'use client'
import { useState, useSyncExternalStore } from 'react'
import {
  DIALS,
  DIAL_KEYS,
  type DialKey,
  subscribe,
  revisionSnapshot,
  isRebaking,
  setDial,
  resetDials,
  nonDefaultSettings,
} from '../scene/tunables'
import { PACE_ROWS, totalSecondsFor, authoredTotalSeconds } from '../pace-table'

/**
 * Round 9 (Task 30) — the ?tune=1 roughness panel. A hand-rolled dev overlay (no new
 * dep): plain range inputs + number readouts, grouped by dial.group, bound to the shared
 * `DIALS` store so a drag writes the tunable the bake/uniforms read. Live dials apply on
 * the next frame; rebake dials debounce then re-run the bake (a "rebaking…" badge shows
 * meanwhile). "reset" restores defaults; "copy" exports the non-default values as JSON
 * for Aram to paste into chat. Not a shipped surface — only mounts behind the flag, so a
 * compact dark-translucent dev-tool look is the target, not polish.
 *
 * Task 129 — the pace group needed no new panel code to RENDER (the group-header loop
 * below was already generic; see tunables.ts's own header for why). It gets one addition
 * of its own: `PaceReadout` below, which turns the live rates into the seconds Aram
 * actually asked to pick — each row's crossing time plus the story's authored total —
 * read straight off `pace-table.ts`'s own `totalSecondsFor`/`authoredTotalSeconds` rather
 * than re-derived here.
 */

// Decimal places to display, derived from the dial's step (so 0.001 → 3 places, 1 → 0).
function decimalsFor(step: number): number {
  if (step >= 1) return 0
  const s = String(step)
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

// Bottom-right dock inside the only band clear of BOTH flanking chapter cards (which
// slide in near the left+right edges, centred ~34vh, reaching ~58vh deep during a
// dwell) and the centred planet. The height cap keeps the top edge below that card
// band; taller-than-cap content scrolls. Not a shipped surface — dev ergonomics.
const CARD: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  width: 230,
  maxHeight: '40vh',
  overflowY: 'auto',
  zIndex: 60,
  pointerEvents: 'auto',
  background: 'rgba(18, 20, 26, 0.9)',
  color: '#e6e8ee',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '8px 10px 10px',
  font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(6px)',
}

const BTN: React.CSSProperties = {
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.08)',
  color: '#e6e8ee',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 5,
  padding: '3px 8px',
  font: 'inherit',
}

function DialRow({ dialKey }: { dialKey: DialKey }) {
  const d = DIALS[dialKey]
  const changed = d.value !== d.default
  const places = decimalsFor(d.step)
  return (
    <label style={{ display: 'block', margin: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ opacity: 0.85 }}>{d.label}</span>
        <span style={{ color: changed ? '#ffcf6b' : '#aab' }}>{d.value.toFixed(places)}</span>
      </div>
      <input
        type="range"
        min={d.min}
        max={d.max}
        step={d.step}
        value={d.value}
        onChange={(e) => setDial(dialKey, Number(e.target.value))}
        style={{ width: '100%', accentColor: '#ffcf6b' }}
      />
    </label>
  )
}

/**
 * Task 129 — the pace group's own live readout: each row's authored crossing time
 * plus the whole story's authored total, both in seconds. Purely a display of
 * `pace-table.ts`'s OWN computation (`totalSecondsFor` / `authoredTotalSeconds`) —
 * no re-derivation here — so it can never drift from what the scene actually
 * paces. Re-renders whenever a dial changes because the parent `TunePanel`
 * already subscribes to the store via `useSyncExternalStore`.
 */
function PaceReadout() {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 6,
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: 10,
          opacity: 0.55,
          marginBottom: 2,
        }}
      >
        pace readout — seconds
      </div>
      {PACE_ROWS.map((row) => (
        <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.label}
          </span>
          <span style={{ flex: '0 0 auto' }}>{totalSecondsFor(row).toFixed(2)}s</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 600 }}>
        <span>story total</span>
        <span>{authoredTotalSeconds().toFixed(2)}s</span>
      </div>
    </div>
  )
}

/** Best-effort clipboard write with a legacy execCommand fallback for non-secure hosts. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function TunePanel() {
  // Re-render on any dial change or rebake toggle (values live on the shared store).
  useSyncExternalStore(subscribe, revisionSnapshot, revisionSnapshot)
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const rebaking = isRebaking()

  const onCopy = async () => {
    // Pretty-printed (2-space indent) so the pasted blob reads cleanly in chat —
    // still every non-default dial, pace included, via the same DIAL_KEYS-driven
    // `nonDefaultSettings()` the store already exposes.
    const ok = await copyText(JSON.stringify(nonDefaultSettings(), null, 2))
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied(null), 1200)
  }

  // Group headers derived from the store, so Task 31's "water" group appears with no edit.
  let lastGroup = ''

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ ...BTN, flex: '0 0 auto', padding: '2px 7px' }}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'} tune
        </button>
        {rebaking && <span style={{ color: '#ffcf6b', flex: '1 1 auto' }}>rebaking…</span>}
      </div>

      {open && (
        <>
          {DIAL_KEYS.map((k) => {
            const group = DIALS[k].group
            const header = group !== lastGroup ? group : null
            lastGroup = group
            return (
              <div key={k}>
                {header && (
                  <div
                    style={{
                      marginTop: 10,
                      marginBottom: 2,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontSize: 10,
                      opacity: 0.55,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      paddingBottom: 2,
                    }}
                  >
                    {header}
                  </div>
                )}
                <DialRow dialKey={k} />
              </div>
            )
          })}

          <PaceReadout />

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button type="button" onClick={resetDials} style={{ ...BTN, flex: 1 }}>
              reset
            </button>
            <button type="button" onClick={onCopy} style={{ ...BTN, flex: 1 }}>
              {copied === 'ok' ? 'copied ✓' : copied === 'fail' ? 'copy failed' : 'copy'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
