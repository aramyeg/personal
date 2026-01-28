import type { Experience } from '@/types'

export const experiences: Experience[] = [
  {
    id: 'xdatagroup',
    company: 'xDataGroup',
    role: 'Technical Lead / Senior Frontend Engineer',
    location: 'Estonia (Remote)',
    period: 'May 2023 - Present',
    startDate: '2023-05',
    endDate: null,
    description:
      'Leading frontend development for AMIO Bank retail banking platform and a property management startup. Architecting core features, mentoring developers, and working directly with founders on product definition.',
    highlights: [
      'Lead frontend architecture for AMIO Bank iBank web platform',
      'Architect core banking features: transfers, account management, transactions',
      'Work directly with founders on PropTech startup from specs to code',
      'Mentor junior and mid-level developers',
    ],
    technologies: [
      'Next.js',
      'React',
      'TypeScript',
      'Redux RTK',
      'TanStack Query',
      'Chakra UI',
      'Shadcn',
      'Prisma',
    ],
  },
  {
    id: 'akna',
    company: 'AKNA',
    role: 'Senior Frontend Developer',
    location: 'Yerevan, Armenia',
    period: 'Feb 2022 - Jun 2023',
    startDate: '2022-02',
    endDate: '2023-06',
    description:
      'Built scalable e-commerce platforms with focus on architecture and reusable component libraries.',
    highlights: [
      'Designed and implemented component library architecture',
      'Built e-commerce platform features',
      'Established coding standards and best practices',
    ],
    technologies: ['React', 'TypeScript', 'Next.js', 'Redux', 'Styled Components'],
  },
  {
    id: 'accenture',
    company: 'Accenture',
    role: 'Senior React Native Developer',
    location: 'Dubai (Remote)',
    period: 'Jul 2021 - Mar 2022',
    startDate: '2021-07',
    endDate: '2022-03',
    description:
      'Developed mobile banking features for Saudi National Bank, one of the largest banks in the Middle East.',
    highlights: [
      'Built car leasing feature for SNB mobile app',
      'Implemented secure financial transaction flows',
      'Collaborated with cross-functional teams across time zones',
    ],
    technologies: ['React Native', 'TypeScript', 'Redux', 'Jest', 'Native Modules'],
  },
  {
    id: '360dialog',
    company: '360dialog',
    role: 'Frontend Web Developer',
    location: 'Berlin (Remote)',
    period: 'Nov 2019 - Oct 2021',
    startDate: '2019-11',
    endDate: '2021-10',
    description:
      'Built enterprise-grade WhatsApp Business API platform serving 50,000+ businesses worldwide.',
    highlights: [
      'Developed partner platform for managing WhatsApp Business Accounts',
      'Built dashboard handling 4B+ messages',
      'Implemented real-time messaging features',
    ],
    technologies: ['React', 'TypeScript', 'GraphQL', 'Node.js', 'PostgreSQL'],
  },
  {
    id: 'flyerbee',
    company: 'FLYERBEE AG',
    role: 'React Native Developer',
    location: 'Zürich (Remote)',
    period: 'Oct 2018 - Nov 2019',
    startDate: '2018-10',
    endDate: '2019-11',
    description:
      'Built logistics SaaS mobile application from scratch, enabling efficient fleet management.',
    highlights: [
      'Built companion mobile app from ground up',
      'Implemented real-time tracking features',
      'First professional mobile development role',
    ],
    technologies: ['React Native', 'JavaScript', 'Redux', 'Node.js'],
  },
  {
    id: 'bluenet',
    company: 'BlueNet / FreeDOM',
    role: 'Frontend Developer',
    location: 'Yerevan, Armenia',
    period: '2016 - 2018',
    startDate: '2016-01',
    endDate: '2018-10',
    description:
      'Started software development career building hotel management systems and various web applications.',
    highlights: [
      'Transitioned from marketing to software development',
      'Built hotel management applications with Electron.js',
      'Developed full-stack features with React and Node.js',
    ],
    technologies: ['React', 'JavaScript', 'Electron.js', 'Node.js', 'HTML/CSS'],
  },
]
