import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionCanvasAppV4 from '../app/components/ReactionCanvasAppV4';

const meta = {
  title: 'App/ReactionCanvasAppV4',
  component: ReactionCanvasAppV4,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ReactionCanvasAppV4>;

export default meta;
type Story = StoryObj<typeof meta>;

// Full-page canvas — shows QR gate on desktop unless ?forceView=mobile is set.
export const Default: Story = {};
