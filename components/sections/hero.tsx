'use client'

import { useState, useEffect, useRef } from 'react'
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

type Px = [x: number, y: number, w: number, h: number]

const px = (list: Px[], className: string) =>
  list.map(([x, y, w, h], i) => (
    <rect key={`${className}-${i}`} x={x} y={y} width={w} height={h} className={className} />
  ))

// 32×37 grid, drawn in layers bottom-up. Tee is theme-reactive
// (black in light mode, cream in dark) like the original avatar.
const BUZZ_TOP: Px[] = [
  [11, 2, 10, 1],
  [10, 3, 12, 1],
  [9, 4, 2, 1],
  [21, 4, 2, 1],
]
const BUZZ_FADE: Px[] = [
  [11, 4, 10, 1],
  [9, 5, 1, 2],
  [22, 5, 1, 2],
]
const FACE: Px[] = [
  [10, 5, 12, 2],
  [9, 7, 14, 2],
  [10, 9, 12, 3],
  [11, 12, 10, 1],
  [12, 13, 8, 1],
  [8, 7, 1, 2], // left ear
  [23, 7, 1, 2], // right ear
  [13, 14, 6, 2], // neck
]
const BROWS: Px[] = [
  [11, 5, 3, 1],
  [18, 5, 3, 1],
]
const EYE_WHITES: Px[] = [
  [11, 7, 3, 2],
  [18, 7, 3, 2],
]
const LASHES: Px[] = [
  [11, 8, 3, 1],
  [18, 8, 3, 1],
]
const STUBBLE: Px[] = [
  [11, 12, 10, 1],
  [12, 13, 8, 1],
]
const TEE: Px[] = [
  [8, 16, 16, 1],
  [6, 17, 20, 1],
  [5, 18, 22, 10],
  [3, 18, 2, 4], // left sleeve
  [27, 18, 2, 4], // right sleeve
]
const TEE_PRINT: Px[] = [
  [16, 19, 2, 1],
  [14, 20, 3, 1],
  [13, 21, 3, 1],
  [15, 22, 3, 1],
  [14, 23, 2, 1],
  [13, 24, 1, 1],
]
const ARMS: Px[] = [
  [3, 22, 2, 5],
  [27, 22, 2, 5],
]
const HANDS: Px[] = [
  [3, 27, 2, 2],
  [27, 27, 2, 2],
]
const JEANS: Px[] = [
  [7, 28, 18, 2],
  [7, 30, 8, 4],
  [17, 30, 8, 4],
]
const BOOTS: Px[] = [
  [6, 34, 9, 2],
  [17, 34, 9, 2],
]

function PixelAvatar() {
  const [isBlinking, setIsBlinking] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [showMessage, setShowMessage] = useState<string | null>(null)
  // Pupil offset in whole pixels: x/y each in {-1, 0, 1}
  const [look, setLook] = useState({ x: 0, y: 0 })
  const figureRef = useRef<HTMLDivElement>(null)

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

  // Blink every 3-5 seconds
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const interval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  // Eyes follow the cursor, snapping in whole-pixel steps
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = figureRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height * 0.22) // eye line, not figure center
        setLook({
          x: Math.abs(dx) < 40 ? 0 : Math.sign(dx),
          y: dy < -50 ? -1 : dy > 90 ? 1 : 0,
        })
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
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
        'background: #b0563d; color: #faf8f5; padding: 10px; font-size: 14px; font-weight: bold;'
      )
    }
  }

  // Pupils: 1×2 column centered in each 3×2 eye; looking up/down shrinks
  // to the top/bottom row so the shift stays on the pixel grid.
  const pupilY = look.y === 0 ? 7 : look.y < 0 ? 7 : 8
  const pupilH = look.y === 0 ? 2 : 1

  return (
    <div className="relative cursor-pointer" onClick={handleClick} ref={figureRef}>
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

      {/* Floating figure with idle animation — no frame, the figure IS the element */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="w-40 sm:w-48"
      >
        <svg
          viewBox="0 0 32 37"
          className="w-full h-auto"
          shapeRendering="crispEdges"
          role="img"
          aria-label="Pixel-art portrait of Aram: buzz cut, band tee, jeans"
        >
          {/* Hair — buzz cut with fade */}
          {px(BUZZ_TOP, 'fill-stone-800 dark:fill-stone-300')}
          {px(BUZZ_FADE, 'fill-stone-600 dark:fill-stone-400')}

          {/* Face, ears, neck */}
          {px(FACE, 'fill-[#eec9a2] dark:fill-[#e3b98f]')}
          {/* Neck shadow */}
          <rect x={13} y={14} width={6} height={1} className="fill-[#d9a878]/70 dark:fill-[#c99666]/70" />

          {/* Brows */}
          {px(BROWS, 'fill-stone-600 dark:fill-stone-400')}

          {/* Eyes */}
          {isBlinking ? (
            px(LASHES, 'fill-stone-600 dark:fill-stone-500')
          ) : (
            <>
              {px(EYE_WHITES, 'fill-stone-50')}
              <rect
                x={12 + look.x}
                y={pupilY}
                width={1}
                height={pupilH}
                className="fill-stone-900"
              />
              <rect
                x={19 + look.x}
                y={pupilY}
                width={1}
                height={pupilH}
                className="fill-stone-900"
              />
            </>
          )}

          {/* Nose shadow */}
          <rect x={15} y={9} width={2} height={2} className="fill-[#d9a878]/70 dark:fill-[#c99666]/70" />

          {/* Mouth */}
          <rect x={14} y={11} width={3} height={1} className="fill-[#c08862] dark:fill-[#b07a55]" />

          {/* Stubble over the jaw */}
          {px(STUBBLE, 'fill-stone-700/25 dark:fill-stone-400/25')}

          {/* Band tee — theme-reactive, with abstract bolt print */}
          {px(TEE, 'fill-stone-900 dark:fill-stone-100')}
          <rect x={13} y={16} width={6} height={1} className="fill-stone-800 dark:fill-stone-200" />
          {px(TEE_PRINT, 'fill-[#e0a878] dark:fill-[#8c5b45]')}

          {/* Arms and hands */}
          {px(ARMS, 'fill-[#eec9a2] dark:fill-[#e3b98f]')}
          {px(HANDS, 'fill-[#dfb389] dark:fill-[#d3a276]')}

          {/* Jeans and boots */}
          {px(JEANS, 'fill-stone-600 dark:fill-stone-500')}
          {px(BOOTS, 'fill-stone-800 dark:fill-stone-700')}
        </svg>
      </motion.div>
    </div>
  )
}
