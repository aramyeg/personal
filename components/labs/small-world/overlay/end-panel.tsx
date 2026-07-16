'use client'
import type * as React from 'react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { PALETTE } from '../palette'

export function EndPanel() {
  return (
    <div
      data-testid="sw-panel-end"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(43, 43, 51, 0.4)',
      }}
    >
      <div
        style={{
          border: `4px solid ${PALETTE.ink}`,
          borderRadius: 6,
          boxShadow: `10px 12px 0 ${PALETTE.ink}`,
          background: PALETTE.horizon,
          padding: '34px 42px',
          textAlign: 'center',
          transform: 'rotate(-2deg)',
          color: PALETTE.ink,
        }}
      >
        <p style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 34, letterSpacing: 2, margin: '0 0 6px' }}>
          To be continued…
        </p>
        <p style={{ fontFamily: 'var(--sw-font-body)', fontSize: 14, margin: '0 0 18px' }}>
          The next chapter is unwritten. Say hi:
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`mailto:${siteConfig.email}`} style={linkStyle(PALETTE.honey)}>Email</a>
          {socialLinks.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" style={linkStyle(PALETTE.blossom)}>
              {l.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function linkStyle(bg: string): React.CSSProperties {
  return {
    fontFamily: 'var(--sw-font-display)',
    fontWeight: 700,
    fontSize: 14,
    color: PALETTE.ink,
    textDecoration: 'none',
    padding: '8px 18px',
    borderRadius: 999,
    border: `3px solid ${PALETTE.ink}`,
    background: bg,
  }
}
