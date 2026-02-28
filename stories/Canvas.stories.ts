import type { Meta, StoryObj } from '@storybook/react-vite';
import Canvas from '../app/components/Canvas';

// Note: Canvas uses usePartySocket internally (mocked in Storybook).
// Cursor dots come from real-time socket messages so won't appear here.
// These stories focus on the background colour states driven by the currentVoteState prop.

const meta = {
  title: 'App/Canvas',
  component: Canvas,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  argTypes: {
    currentVoteState: {
      control: 'select',
      options: ['agree', 'disagree', 'pass'],
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

// No vote selected — neutral transparent background.
export const Default: Story = {
  args: { ...baseArgs },
};

// Cursor is in the AGREE region — green background tint.
export const AgreeBackground: Story = {
  args: { ...baseArgs, currentVoteState: 'agree' },
};

// Cursor is in the DISAGREE region — red background tint.
export const DisagreeBackground: Story = {
  args: { ...baseArgs, currentVoteState: 'disagree' },
};

// Cursor is in the PASS region — yellow background tint.
export const PassBackground: Story = {
  args: { ...baseArgs, currentVoteState: 'pass' },
};
