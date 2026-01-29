'use client'

import { useEffect, useState, useCallback } from 'react'

// Konami Code: up up down down left right left right b a
const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
]

// Secret word: "aram"
const SECRET_WORD = ['KeyA', 'KeyR', 'KeyA', 'KeyM']

type EasterEgg = 'konami' | 'secret' | 'matrix' | 'party'

export function useEasterEggs() {
  const [keySequence, setKeySequence] = useState<string[]>([])
  const [activatedEggs, setActivatedEggs] = useState<Set<EasterEgg>>(new Set())
  const [showNotification, setShowNotification] = useState<string | null>(null)

  const activate = useCallback((egg: EasterEgg, message: string) => {
    setActivatedEggs((prev) => new Set([...prev, egg]))
    setShowNotification(message)
    setTimeout(() => setShowNotification(null), 3000)

    // Log to console as a fun discovery
    console.log(
      `%c 🎉 Easter Egg Discovered: ${message} `,
      'background: linear-gradient(90deg, #ff6b6b, #ffd93d); color: black; padding: 10px; font-size: 16px; font-weight: bold; border-radius: 5px;'
    )
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const newSequence = [...keySequence, e.code].slice(-10)
      setKeySequence(newSequence)

      // Check for Konami code
      if (newSequence.length === 10 && newSequence.join(',') === KONAMI_CODE.join(',')) {
        activate('konami', '🎮 Konami Code Activated! You found the secret!')
        setKeySequence([])
      }

      // Check for secret word "aram"
      if (
        newSequence.slice(-4).join(',') === SECRET_WORD.join(',') &&
        !activatedEggs.has('secret')
      ) {
        activate('secret', '👋 You found me! Thanks for visiting!')
        setKeySequence([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keySequence, activatedEggs, activate])

  // Log welcome message on mount
  useEffect(() => {
    console.log(
      `%c
    ██╗  ██╗███████╗██╗     ██╗      ██████╗
    ██║  ██║██╔════╝██║     ██║     ██╔═══██╗
    ███████║█████╗  ██║     ██║     ██║   ██║
    ██╔══██║██╔══╝  ██║     ██║     ██║   ██║
    ██║  ██║███████╗███████╗███████╗╚██████╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝

    Welcome, curious developer! 👋
    Looking for easter eggs? Try:
    - Typing something special...
    - The classic cheat code gamers know
    - Clicking things multiple times

    Built with ❤️ by Aram
      `,
      'color: #c97f5a; font-family: monospace;'
    )
  }, [])

  return {
    activatedEggs,
    showNotification,
    isKonamiActive: activatedEggs.has('konami'),
    isSecretActive: activatedEggs.has('secret'),
  }
}
