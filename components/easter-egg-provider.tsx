'use client'

import { createContext, useContext, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEasterEggs } from '@/hooks'

type EasterEggContextType = {
  isKonamiActive: boolean
  isSecretActive: boolean
}

const EasterEggContext = createContext<EasterEggContextType>({
  isKonamiActive: false,
  isSecretActive: false,
})

export function useEasterEggContext() {
  return useContext(EasterEggContext)
}

export function EasterEggProvider({ children }: { children: ReactNode }) {
  const { showNotification, isKonamiActive, isSecretActive } = useEasterEggs()

  return (
    <EasterEggContext.Provider value={{ isKonamiActive, isSecretActive }}>
      {/* Konami code effect - matrix rain */}
      <AnimatePresence>
        {isKonamiActive && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-primary/30 text-sm font-mono"
                initial={{
                  x: Math.random() * 100 + '%',
                  y: -20,
                  opacity: 0,
                }}
                animate={{
                  y: '100vh',
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: 3,
                  delay: Math.random() * 2,
                  ease: 'linear',
                }}
              >
                {['0', '1', '♦', '♠', '◆', '▲', '●'][Math.floor(Math.random() * 7)]}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Notification toast */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow-2xl"
          >
            {showNotification}
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </EasterEggContext.Provider>
  )
}
