'use client'

/** Radial manga speed-lines at the frame edges; pure CSS, GPU-cheap. */
export function SpeedLines({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: active ? 1 : 0,
        transition: 'opacity 160ms ease-out',
        background:
          'repeating-conic-gradient(from 0deg at 50% 46%, rgba(43,43,51,0.85) 0deg 1.2deg, transparent 1.2deg 7deg)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 46%, transparent 42%, black 78%)',
        maskImage: 'radial-gradient(ellipse at 50% 46%, transparent 42%, black 78%)',
      }}
    />
  )
}
