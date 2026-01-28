'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

type ScrollProgressProps = {
  className?: string
}

export function ScrollProgress({ className }: ScrollProgressProps) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className={className}
      style={{
        scaleX,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'var(--primary)',
        transformOrigin: '0%',
        zIndex: 100,
      }}
    />
  )
}
