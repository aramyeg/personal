import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
}

export const Destructive: Story = {
  args: {
    children: 'Destructive',
    variant: 'destructive',
  },
}

export const Outline: Story = {
  args: {
    children: 'Outline',
    variant: 'outline',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
}

export const TechStack: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">React</Badge>
      <Badge variant="default">TypeScript</Badge>
      <Badge variant="default">Next.js</Badge>
      <Badge variant="default">Tailwind CSS</Badge>
      <Badge variant="secondary">GraphQL</Badge>
      <Badge variant="secondary">Node.js</Badge>
    </div>
  ),
}

export const SkillLevels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="bg-primary/20 text-primary border-primary/30">Expert</Badge>
      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Advanced</Badge>
      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Intermediate</Badge>
    </div>
  ),
}

export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="bg-primary/20 text-primary">Available</Badge>
      <Badge className="bg-amber-500/20 text-amber-500">In Progress</Badge>
      <Badge variant="destructive">Urgent</Badge>
    </div>
  ),
}
