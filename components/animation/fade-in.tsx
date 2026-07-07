'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

type FadeInProps = {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
  once?: boolean
  amount?: number
}

const getDirectionOffset = (
  direction: FadeInProps['direction'],
  distance: number
) => {
  switch (direction) {
    case 'up':
      return { y: distance }
    case 'down':
      return { y: -distance }
    case 'left':
      return { x: distance }
    case 'right':
      return { x: -distance }
    default:
      return {}
  }
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  distance = 12,
  once = true,
  amount = 0.3,
}: FadeInProps) {
  // Content must never be hidden: it renders fully visible before hydration
  // and the scroll trigger only adds a subtle settle-into-place translate.
  const variants: Variants = {
    hidden: {
      opacity: 1,
      ...getDirectionOffset(direction, distance),
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
    >
      {children}
    </motion.div>
  )
}
