'use client'

import { useEffect } from 'react'
import { useCuratorStore, type Toast } from '../store'
import styles from '../curator.module.css'

const AUTO_DISMISS_MS = 5000

function ToastCard({ toast }: { toast: Toast }) {
  const dismissToast = useCuratorStore((s) => s.dismissToast)

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismissToast])

  return (
    <div
      className={`${styles.toastEnter} flex items-start gap-2 rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-3`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-[12px] text-[var(--c-text-soft)]">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 text-[13px] leading-none text-[var(--c-text-soft)] transition-colors duration-150 hover:text-[var(--c-text)]"
      >
        ×
      </button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useCuratorStore((s) => s.toasts)

  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
