export const siteConfig = {
  name: 'Aram Yeghiazaryan',
  title: 'Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications.',
  email: 'aramyeg@gmail.com',
  location: 'Yerevan, Armenia',
  available: true,
}

export const socialLinks = [
  {
    name: 'GitHub',
    url: 'https://github.com/aramyeg',
    icon: 'github',
  },
  {
    name: 'LinkedIn',
    url: 'https://linkedin.com/in/aramyeg',
    icon: 'linkedin',
  },
]

export const animation = {
  duration: {
    instant: 0.1,
    fast: 0.2,
    normal: 0.4,
    slow: 0.6,
    slower: 0.8,
  },
  ease: {
    default: [0.25, 0.1, 0.25, 1],
    spring: { type: 'spring', stiffness: 400, damping: 30 },
    bounce: { type: 'spring', stiffness: 300, damping: 20 },
    gentle: { type: 'spring', stiffness: 100, damping: 15 },
  },
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.15,
  },
}
