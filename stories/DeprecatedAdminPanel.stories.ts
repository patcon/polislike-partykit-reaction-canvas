import type { Meta, StoryObj } from '@storybook/react-vite';
import DeprecatedAdminPanel from '../app/components/panels/DeprecatedAdminPanel';

// DeprecatedAdminPanel is heavily socket-driven: it starts in a loading state and
// populates once the PartyKit server sends back the statements pool and queue
// via WebSocket.  In Storybook the socket is mocked (no real connection),
// so the panel stays in its initial loading state.  This story is useful for
// verifying the loading UI and overall layout; full interactive state requires
// a live PartyKit server (run `npm run dev`).

const meta = {
  title: 'App/DeprecatedAdminPanel',
  component: DeprecatedAdminPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Admin view for queuing statements and viewing votes. Connects to PartyKit over WebSocket; in Storybook the socket is mocked so only the loading state is visible.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DeprecatedAdminPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    room: 'default',
  },
};
