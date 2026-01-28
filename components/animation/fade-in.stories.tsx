import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FadeIn } from './fade-in'

const meta = {
  title: 'Animation/FadeIn',
  component: FadeIn,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: 'select',
      options: ['up', 'down', 'left', 'right', 'none'],
    },
    delay: {
      control: { type: 'range', min: 0, max: 2, step: 0.1 },
    },
    duration: {
      control: { type: 'range', min: 0.1, max: 2, step: 0.1 },
    },
    distance: {
      control: { type: 'range', min: 0, max: 100, step: 4 },
    },
  },
} satisfies Meta<typeof FadeIn>

export default meta
type Story = StoryObj<typeof meta>

const ExampleCard = () => (
  <div className="p-6 rounded-xl bg-card border border-border w-64">
    <h3 className="font-semibold mb-2">Animated Card</h3>
    <p className="text-sm text-muted-foreground">
      This card fades in with a smooth animation when it enters the viewport.
    </p>
  </div>
)

export const Default: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'up',
    delay: 0,
    duration: 0.5,
    distance: 24,
  },
}

export const FadeUp: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'up',
  },
}

export const FadeDown: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'down',
  },
}

export const FadeLeft: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'left',
  },
}

export const FadeRight: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'right',
  },
}

export const FadeOnly: Story = {
  args: {
    children: <ExampleCard />,
    direction: 'none',
  },
}

export const WithDelay: Story = {
  args: {
    children: <ExampleCard />,
    delay: 0.5,
  },
}

export const SlowAnimation: Story = {
  args: {
    children: <ExampleCard />,
    duration: 1.5,
  },
}

export const LargeDistance: Story = {
  args: {
    children: <ExampleCard />,
    distance: 60,
  },
}

export const SequentialFade: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FadeIn delay={0}>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">First Item</div>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">Second Item</div>
      </FadeIn>
      <FadeIn delay={0.4}>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">Third Item</div>
      </FadeIn>
    </div>
  ),
}

export const DirectionShowcase: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-8">
      <FadeIn direction="up" delay={0}>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="font-semibold">Fade Up</p>
        </div>
      </FadeIn>
      <FadeIn direction="down" delay={0.2}>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="font-semibold">Fade Down</p>
        </div>
      </FadeIn>
      <FadeIn direction="left" delay={0.4}>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="font-semibold">Fade Left</p>
        </div>
      </FadeIn>
      <FadeIn direction="right" delay={0.6}>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="font-semibold">Fade Right</p>
        </div>
      </FadeIn>
    </div>
  ),
}
