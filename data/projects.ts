import type { Project } from '@/types'

export const projects: Project[] = [
  {
    id: '360dialog',
    title: '360dialog Platform',
    description:
      'Enterprise WhatsApp Business API platform trusted by 50,000+ businesses worldwide.',
    longDescription:
      'Built the partner platform for managing unlimited WhatsApp Business Accounts. The platform handles over 4 billion messages and provides real-time messaging infrastructure for enterprise clients.',
    role: 'Frontend Web Developer',
    company: '360dialog',
    metrics: ['50,000+ businesses', '4B+ messages handled', '2 years development'],
    technologies: ['React', 'TypeScript', 'GraphQL', 'Node.js', 'PostgreSQL'],
    link: 'https://360dialog.com',
  },
  {
    id: 'snb-mobile',
    title: 'SNB Mobile Banking',
    description:
      'Mobile banking app for Saudi National Bank with 5M+ downloads and 4.7-star rating.',
    longDescription:
      'Developed the car leasing feature for one of the largest banks in the Middle East. The app serves millions of users with secure financial transactions, bill payments, and account management.',
    role: 'Senior React Native Developer',
    company: 'Accenture (for Saudi National Bank)',
    metrics: ['5M+ downloads', '4.7★ rating', '268K+ reviews'],
    technologies: ['React Native', 'TypeScript', 'Redux', 'Native Modules'],
  },
  {
    id: 'amio-bank',
    title: 'AMIO Bank iBank',
    description:
      'Retail banking web platform for AMIO Bank, providing comprehensive financial services in Armenia.',
    longDescription:
      'Leading frontend development for the internet banking platform. Architecting core features including transfers, account management, and transaction history with state-of-the-art security.',
    role: 'Technical Lead',
    company: 'xDataGroup (for AMIO Bank)',
    metrics: ['Full retail banking suite', 'Technical leadership', 'Ongoing development'],
    technologies: [
      'Next.js',
      'TypeScript',
      'Redux RTK',
      'TanStack Query',
      'Chakra UI',
    ],
    link: 'https://amiobank.am',
  },
]
