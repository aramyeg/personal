'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
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

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('m')
    if (isModule(m)) setModule(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adopt URL once on mount
  }, [])

  useEffect(() => {
    const url = activeModule === 'overview' ? window.location.pathname : `?m=${activeModule}`
    window.history.replaceState(null, '', url)
  }, [activeModule])

  const Active = MODULES[activeModule]
  return (
    <div key={activeModule} className={styles.moduleEnter}>
      <Active />
    </div>
  )
}
