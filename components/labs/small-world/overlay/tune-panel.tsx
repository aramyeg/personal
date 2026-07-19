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

/**
 * Round 9 (Task 30) — the ?tune=1 roughness panel. A hand-rolled dev overlay (no new
 * dep): plain range inputs + number readouts, grouped by dial.group, bound to the shared
 * `DIALS` store so a drag writes the tunable the bake/uniforms read. Live dials apply on
 * the next frame; rebake dials debounce then re-run the bake (a "rebaking…" badge shows
 * meanwhile). "reset" restores defaults; "copy" exports the non-default values as JSON
 * for Aram to paste into chat. Not a shipped surface — only mounts behind the flag, so a
 * compact dark-translucent dev-tool look is the target, not polish.
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
    const ok = await copyText(JSON.stringify(nonDefaultSettings()))
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
