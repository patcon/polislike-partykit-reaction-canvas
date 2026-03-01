import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionCanvasAppV2 from '../app/components/ReactionCanvasAppV2';

const meta = {
  title: 'App/ReactionCanvasAppV2',
  component: ReactionCanvasAppV2,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ReactionCanvasAppV2>;

export default meta;
type Story = StoryObj<typeof meta>;

// No video — shows the placeholder state.
export const Default: Story = {};

// With a real YouTube video embedded above the canvas.
export const WithVideo: Story = {
  args: {
    videoId: 'dQw4w9WgXcQ',
  },
};
