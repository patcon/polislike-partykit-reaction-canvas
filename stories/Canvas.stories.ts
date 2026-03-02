import type { Meta, StoryObj } from '@storybook/react-vite';
import Canvas from '../app/components/Canvas';

// Note: Canvas uses usePartySocket internally (mocked in Storybook).
// Cursor dots come from real-time socket messages so won't appear here.
// These stories focus on the background colour states driven by the currentReactionState prop.

const meta = {
  title: 'App/Canvas',
  component: Canvas,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  argTypes: {
    currentReactionState: {
      control: 'select',
      options: ['positive', 'negative', 'neutral'],
    },
  },
} satisfies Meta<typeof Canvas>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  room: 'storybook',
  userId: 'story-user',
  colorCursorsByVote: true,
};

// No reaction selected — neutral transparent background.
export const Default: Story = {
  args: { ...baseArgs },
};

// Cursor is in the POSITIVE region — green background tint.
export const PositiveBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'positive' },
};

// Cursor is in the NEGATIVE region — red background tint.
export const NegativeBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'negative' },
};

// Cursor is in the NEUTRAL region — yellow background tint.
export const NeutralBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'neutral' },
};
