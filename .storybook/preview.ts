import type { Preview } from '@storybook/nextjs-vite'
import '../app/globals.css'
import '../lib/fonts'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'light', value: '#fafafa' },
        { name: 'dark', value: '#131316' },
      ],
    },
  },
}

export default preview
