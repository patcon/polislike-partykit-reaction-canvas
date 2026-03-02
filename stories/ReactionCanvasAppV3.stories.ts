import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionCanvasAppV3 from '../app/components/ReactionCanvasAppV3';

const meta = {
  title: 'App/ReactionCanvasAppV3',
  component: ReactionCanvasAppV3,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ReactionCanvasAppV3>;

export default meta;
type Story = StoryObj<typeof meta>;

// Full-page canvas — shows QR gate on desktop unless ?forceView=mobile is set.
export const Default: Story = {};
