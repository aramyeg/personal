'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { MODULE_IDS, useCuratorStore, type CuratorModule } from './store'
import { SkeletonModule } from './ui/skeleton-module'
import styles from './curator.module.css'

const loading = () => <SkeletonModule />
const MODULES: Record<CuratorModule, ReturnType<typeof dynamic>> = {
  overview: dynamic(() => import('./modules/overview'), { loading }),
  rooms: dynamic(() => import('./modules/rooms'), { loading }),
  personnel: dynamic(() => import('./modules/personnel'), { loading }),
  pipeline: dynamic(() => import('./modules/pipeline'), { loading }),
  tickets: dynamic(() => import('./modules/tickets'), { loading }),
  engineering: dynamic(() => import('./modules/engineering'), { loading }),
  settings: dynamic(() => import('./modules/settings'), { loading }),
}

const isModule = (v: string | null): v is CuratorModule =>
  v !== null && (MODULE_IDS as string[]).includes(v)

export function ModuleHost() {
  // Named `activeModule` (not `module`) to avoid the @next/next/no-assign-module-variable lint rule.
  const activeModule = useCuratorStore((s) => s.module)
  const setModule = useCuratorStore((s) => s.setModule)

  // Single effect: adopt a valid ?m= on the first pass (skipping the write so the
  // pre-adoption module never clobbers the URL), then mirror every change back.
  const adopted = useRef(false)
  useEffect(() => {
    if (!adopted.current) {
      adopted.current = true
      const m = new URLSearchParams(window.location.search).get('m')
      if (isModule(m) && m !== activeModule) {
        setModule(m)
        return
      }
    }
    const url = activeModule === 'overview' ? window.location.pathname : `?m=${activeModule}`
    window.history.replaceState(null, '', url)
  }, [activeModule, setModule])

  const Active = MODULES[activeModule]
  return (
    <div key={activeModule} className={styles.moduleEnter}>
      <Active />
    </div>
  )
}
