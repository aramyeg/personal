'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { siteConfig } from '@/lib/constants'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
      {/* Avatar renders immediately; idle motion lives inside PixelAvatar */}
      <div className="relative mb-8">
        <PixelAvatar />
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-center">
        {siteConfig.name}
      </h1>

      <p className="mt-4 text-lg sm:text-xl md:text-2xl text-muted-foreground text-center">
        {siteConfig.title}
      </p>

      <p className="mt-5 max-w-xl text-center text-sm sm:text-base leading-relaxed text-muted-foreground/80">
        I build the frontend of AMIO Bank’s retail banking platform.
        Eight years of fintech and enterprise work for teams in Switzerland,
        Germany, Estonia, Ireland, and the UAE.
      </p>

      <a
        href="#contact"
        className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={(e) => {
          e.preventDefault()
          document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        Open to new opportunities — get in touch
      </a>
    </section>
  )
}

function PixelAvatar() {
  const [isBlinking, setIsBlinking] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [showMessage, setShowMessage] = useState<string | null>(null)

  const clickMessages = [
    '',
    '',
    '',
    'Hey there! 👋',
    'You found me!',
    'Still clicking?',
    "You're persistent! 😄",
    'Okay okay, here is a cookie 🍪',
    'Achievement unlocked: Avatar Clicker!',
    '🎉 You win the clicking game! 🎉',
  ]

  // Blink animation every 3-5 seconds
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }
    const interval = setInterval(() => {
      blink()
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  const handleClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (newCount >= 3 && newCount < clickMessages.length) {
      setShowMessage(clickMessages[newCount])
      setTimeout(() => setShowMessage(null), 2000)
    }
    if (newCount >= 10) {
      console.log(
        '%c 🏆 Achievement Unlocked: Persistent Clicker! ',
        'background: gold; color: black; padding: 10px; font-size: 14px; font-weight: bold;'
      )
    }
  }

  return (
    <div className="relative cursor-pointer" onClick={handleClick}>
      {/* Click message */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap z-50"
          >
            {showMessage}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Floating avatar container with idle animation */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Avatar container with pixel art style */}
        <motion.div
          className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-4 border-primary/30"
          style={{ imageRendering: 'pixelated' }}
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Pixel grid background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />

          {/* Pixel art avatar */}
          <svg
            viewBox="0 0 16 20"
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          >

            {/* Man-bun on top */}
            <rect x="6" y="0" width="4" height="1" className="fill-stone-700 dark:fill-stone-400" />
            <rect x="5" y="1" width="6" height="1" className="fill-stone-700 dark:fill-stone-400" />

            {/* Top of head hair - thick and wavy */}
            <rect x="3" y="2" width="10" height="1" className="fill-stone-700 dark:fill-stone-400" />
            <rect x="3" y="3" width="10" height="1" className="fill-stone-700 dark:fill-stone-400" />

            {/* Side hair flowing down - longer */}
            <rect x="2" y="3" width="1" height="6" className="fill-stone-700 dark:fill-stone-400" />
            <rect x="3" y="4" width="1" height="5" className="fill-stone-600 dark:fill-stone-500" />
            <rect x="12" y="4" width="1" height="5" className="fill-stone-600 dark:fill-stone-500" />
            <rect x="13" y="3" width="1" height="6" className="fill-stone-700 dark:fill-stone-400" />

            {/* Face - Skin tone */}
            <rect x="4" y="4" width="8" height="5" className="fill-amber-200 dark:fill-amber-300" />

            {/* Forehead hair strands */}
            <rect x="4" y="4" width="2" height="1" className="fill-stone-600 dark:fill-stone-500" />
            <rect x="10" y="4" width="2" height="1" className="fill-stone-600 dark:fill-stone-500" />

            {/* Eyes - with blink animation */}
            <AnimatePresence mode="wait">
              {isBlinking ? (
                <>
                  <rect x="5" y="6" width="2" height="1" className="fill-stone-700 dark:fill-stone-600" />
                  <rect x="9" y="6" width="2" height="1" className="fill-stone-700 dark:fill-stone-600" />
                </>
              ) : (
                <>
                  <rect x="5" y="5" width="2" height="2" className="fill-stone-800 dark:fill-stone-700" />
                  <rect x="9" y="5" width="2" height="2" className="fill-stone-800 dark:fill-stone-700" />
                  {/* Eye shine */}
                  <rect x="5" y="5" width="1" height="1" className="fill-white/70" />
                  <rect x="9" y="5" width="1" height="1" className="fill-white/70" />
                </>
              )}
            </AnimatePresence>

            {/* Eyebrows */}
            <rect x="5" y="4" width="2" height="1" className="fill-stone-600 dark:fill-stone-500" />
            <rect x="9" y="4" width="2" height="1" className="fill-stone-600 dark:fill-stone-500" />

            {/* Nose shadow */}
            <rect x="7" y="7" width="2" height="1" className="fill-amber-300/50 dark:fill-amber-400/50" />

            {/* Mouth - simple line, not smile shaped like mustache */}
            <rect x="7" y="8" width="2" height="1" className="fill-rose-400/60 dark:fill-rose-300/60" />

            {/* Neck */}
            <rect x="6" y="9" width="4" height="1" className="fill-amber-200 dark:fill-amber-300" />

            {/* T-shirt - Black in light mode, cream in dark mode */}
            <rect x="2" y="10" width="12" height="5" className="fill-stone-900 dark:fill-stone-100" />
            {/* Collar V-neck */}
            <rect x="7" y="10" width="2" height="2" className="fill-stone-800 dark:fill-stone-200" />
            {/* Shoulders */}
            <rect x="1" y="11" width="1" height="4" className="fill-stone-900 dark:fill-stone-100" />
            <rect x="14" y="11" width="1" height="4" className="fill-stone-900 dark:fill-stone-100" />
            {/* Shirt bottom */}
            <rect x="3" y="15" width="10" height="3" className="fill-stone-900 dark:fill-stone-100" />

            {/* Arms */}
            <rect x="0" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-300" />
            <rect x="15" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-300" />

            {/* Pants hint */}
            <rect x="4" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-600" />
            <rect x="9" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-600" />
          </svg>
        </motion.div>
      </motion.div>

    </div>
  )
}
