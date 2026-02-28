import type { Meta, StoryObj } from '@storybook/react-vite';
import SimpleReactionCanvasAppV1 from '../app/components/SimpleReactionCanvasAppV1';

// Full app rendered in isolation. The socket is mocked so statements won't
// load from the server — the panel shows "Loading statement..." — but the
// canvas, touch layer, and vote labels all render and respond to interaction.

const meta = {
  title: 'App/SimpleReactionCanvasAppV1',
  component: SimpleReactionCanvasAppV1,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SimpleReactionCanvasAppV1>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
