'use client'

import { motion, type Variants } from 'framer-motion'

type TextRevealProps = {
  text: string
  className?: string
  delay?: number
  staggerDelay?: number
  once?: boolean
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
}

export function TextReveal({
  text,
  className,
  delay = 0,
  staggerDelay = 0.03,
  once = true,
  as: Component = 'p',
}: TextRevealProps) {
  const words = text.split(' ')

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: staggerDelay,
      },
    },
  }

  const wordVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      rotateX: -90,
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  }

  const MotionComponent = motion.create(Component)

  return (
    <MotionComponent
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once }}
      variants={containerVariants}
      style={{ perspective: 1000 }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          variants={wordVariants}
          style={{ transformOrigin: 'center bottom' }}
        >
          {word}
          {index < words.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </MotionComponent>
  )
}

type CharacterRevealProps = {
  text: string
  className?: string
  delay?: number
  staggerDelay?: number
  once?: boolean
}

export function CharacterReveal({
  text,
  className,
  delay = 0,
  staggerDelay = 0.02,
  once = true,
}: CharacterRevealProps) {
  const characters = text.split('')

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: staggerDelay,
      },
    },
  }

  const charVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once }}
      variants={containerVariants}
    >
      {characters.map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          className="inline-block"
          variants={charVariants}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.span>
  )
}
