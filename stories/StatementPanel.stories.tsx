import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import StatementPanel from '../app/components/StatementPanel';
import type { PolisStatement } from '../app/types';

const meta = {
  title: 'App/StatementPanel',
  component: StatementPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof StatementPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleStatements: PolisStatement[] = [
  { tid: 1, txt: 'Climate change is the most urgent global challenge of our time and requires immediate systemic action.' },
  { tid: 2, txt: 'Universal basic income would improve quality of life for most citizens.' },
  { tid: 3, txt: 'Social media has done more harm than good to democratic discourse.' },
];

// Before statements have loaded from server.
export const Loading: Story = {
  args: {
    activeStatementId: 1,
    statementsPool: [],
    queue: [],
    currentTime: Date.now(),
  },
};

// Normal display of a statement, no queued next statement.
export const WithStatement: Story = {
  args: {
    activeStatementId: 1,
    statementsPool: sampleStatements,
    queue: [],
    currentTime: Date.now(),
  },
};

// Statement is displaying and the next one is queued (countdown bar visible).
export const WithCountdown: Story = {
  render: () => {
    const now = Date.now();
    return (
      <StatementPanel
        activeStatementId={1}
        statementsPool={sampleStatements}
        queue={[{ statementId: 2, displayTimestamp: now + 8000 }]}
        currentTime={now}
      />
    );
  },
};

// The special id -1 means voting has ended — panel shows "Voting Ended".
export const EndVoting: Story = {
  args: {
    activeStatementId: -1,
    statementsPool: sampleStatements,
    queue: [],
    currentTime: Date.now(),
  },
};
