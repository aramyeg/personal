'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
]

export function Header() {
  const { scrollY } = useScroll()
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 1])
  const headerBlur = useTransform(scrollY, [0, 100], [0, 12])

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      })
    }
  }

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.div
        className="absolute inset-0 border-b border-border/50"
        style={{
          opacity: headerOpacity,
          backdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          backgroundColor: 'hsl(var(--background) / 0.8)',
        }}
      />
      <nav
        className="relative section-container flex items-center justify-between h-16"
        role="navigation"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="font-semibold text-lg tracking-tight hover:text-primary transition-colors"
          aria-label="Go to homepage"
        >
          AY
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileNav onNavClick={handleNavClick} />
        </div>
      </nav>
    </motion.header>
  )
}

type NavLinkProps = {
  href: string
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  className?: string
}

function NavLink({ href, children, onClick, className }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        'relative px-3 py-2 text-sm font-medium text-muted-foreground',
        'hover:text-foreground transition-colors',
        'after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px',
        'after:bg-primary after:scale-x-0 after:transition-transform',
        'hover:after:scale-x-100',
        className
      )}
    >
      {children}
    </a>
  )
}

type MobileNavProps = {
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void
}

function MobileNav({ onNavClick }: MobileNavProps) {
  return (
    <div className="md:hidden">
      <input
        type="checkbox"
        id="mobile-menu"
        className="peer hidden"
      />
      <label
        htmlFor="mobile-menu"
        className="flex flex-col gap-1.5 p-2 cursor-pointer"
      >
        <span className="w-5 h-0.5 bg-foreground transition-all peer-checked:rotate-45 peer-checked:translate-y-2" />
        <span className="w-5 h-0.5 bg-foreground transition-all peer-checked:opacity-0" />
        <span className="w-5 h-0.5 bg-foreground transition-all peer-checked:-rotate-45 peer-checked:-translate-y-2" />
      </label>
      <div className="fixed inset-x-0 top-16 p-4 bg-background/95 backdrop-blur-lg border-b border-border hidden peer-checked:block">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                onNavClick(e, item.href)
                const checkbox = document.getElementById('mobile-menu') as HTMLInputElement
                if (checkbox) checkbox.checked = false
              }}
              className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
