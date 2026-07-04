import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import SimControlBar from '../app/components/demos/SimControlBar';
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext';

// SimControlBar drives the demo-page simulation engine. It needs a RoomSocketProvider
// (partysocket is mocked in Storybook, so send() is a no-op — the bar's UI and engine
// state machine are exercised here without a live server or the recording asset).

const meta = {
  title: 'Demos/SimControlBar',
  component: SimControlBar,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ padding: 40, background: '#fff' }}>
        <RoomSocketProvider room="storybook" userId="sim-driver">
          <Story />
        </RoomSocketProvider>
      </div>
    ),
  ],
} satisfies Meta<typeof SimControlBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Idle bar: program + user-count selects and a Play button.
export const Default: Story = {};

// Drives the state machine through play -> pause -> stop.
export const PlayPauseStop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /play/i }));
    await expect(canvas.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    await expect(canvas.getByText('running')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /pause/i }));
    await expect(canvas.getByText('paused')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /stop/i }));
    await expect(canvas.getByText('idle')).toBeInTheDocument();
  },
};
