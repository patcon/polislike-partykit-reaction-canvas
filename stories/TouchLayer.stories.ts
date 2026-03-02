import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import TouchLayer from '../app/components/TouchLayer';

// TouchLayer is a fully transparent overlay div that captures mouse/touch events
// and translates cursor position into reaction state (positive/negative/neutral) based on
// which region of the canvas the user is in.  It is always used stacked on top of
// a <Canvas> in the real app.  Because it's transparent, this story is mostly
// useful for verifying the callbacks fire correctly via the Actions panel.

const meta = {
  title: 'App/TouchLayer',
  component: TouchLayer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Transparent event-capture layer stacked over Canvas. Converts cursor/touch position to a reaction state and forwards events to the parent via callbacks. Move your cursor around in the story to see Actions fire.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onActiveStatementChange: fn(),
    onReactionStateChange: fn(),
    onBackgroundColorChange: fn(),
  },
} satisfies Meta<typeof TouchLayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    room: 'storybook',
    userId: 'story-user',
  },
};
