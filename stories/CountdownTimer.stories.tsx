import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import CountdownTimer from '../app/components/CountdownTimer';

const meta = {
  title: 'App/CountdownTimer',
  component: CountdownTimer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof CountdownTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

// No queued statements — bar sits full/idle.
export const Idle: Story = {
  args: {
    queue: [],
    currentTime: Date.now(),
  },
};

// A statement is coming up in ~8 seconds.
export const CountingDown: Story = {
  render: () => {
    const now = Date.now();
    return <CountdownTimer queue={[{ statementId: 2, displayTimestamp: now + 8000 }]} currentTime={now} />;
  },
};

// Same countdown but with the next statement ID label shown.
export const CountingDownWithLabel: Story = {
  render: () => {
    const now = Date.now();
    return <CountdownTimer queue={[{ statementId: 3, displayTimestamp: now + 8000 }]} currentTime={now} showNextStatementId />;
  },
};

// Bar is most of the way through — next statement arriving very soon.
export const AlmostExpired: Story = {
  render: () => {
    const now = Date.now();
    return <CountdownTimer queue={[{ statementId: 4, displayTimestamp: now + 2000 }]} currentTime={now} showNextStatementId />;
  },
};

// The "End Voting" pseudo-statement (id -1) is next.
export const EndVotingNext: Story = {
  render: () => {
    const now = Date.now();
    return <CountdownTimer queue={[{ statementId: -1, displayTimestamp: now + 6000 }]} currentTime={now} showNextStatementId />;
  },
};
