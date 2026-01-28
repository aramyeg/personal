'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

type StaggerChildrenProps = {
  children: ReactNode
  className?: string
  staggerDelay?: number
  delayStart?: number
  once?: boolean
  amount?: number
}

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.1,
  delayStart = 0,
  once = true,
  amount = 0.2,
}: StaggerChildrenProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: delayStart,
        staggerChildren: staggerDelay,
      },
    },
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  )
}

type StaggerItemProps = {
  children: ReactNode
  className?: string
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  distance?: number
}

export function StaggerItem({
  children,
  className,
  direction = 'up',
  distance = 20,
}: StaggerItemProps) {
  const getOffset = () => {
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

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      ...getOffset(),
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  }

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
