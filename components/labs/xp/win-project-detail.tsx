'use client'

import { projects } from '@/data'
import type { XpWindow } from './store'

export function WinProjectDetail({ win }: { win: XpWindow }) {
  const project = projects.find((p) => p.id === win.param)
  if (!project) return <div style={{ padding: 12 }}>File not found.</div>
  return (
    <div style={{ padding: 14, fontSize: 12, userSelect: 'text' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 16 }}>{project.icon} {project.title}</h2>
      <p style={{ margin: '0 0 10px', color: '#555' }}>{project.role} · {project.company} · {project.year}</p>
      <p>{project.longDescription ?? project.description}</p>
      {project.metrics && (
        <ul style={{ margin: '8px 0 8px 18px' }}>
          {project.metrics.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {project.technologies.map((t) => (
          <span key={t} style={{ border: '1px solid #7f9db9', background: '#ece9d8', padding: '1px 6px', borderRadius: 2 }}>{t}</span>
        ))}
      </p>
      {project.link && (
        <a href={project.link} target="_blank" rel="noreferrer" style={{ color: '#0026b8' }}>
          Visit project ↗
        </a>
      )}
    </div>
  )
}
