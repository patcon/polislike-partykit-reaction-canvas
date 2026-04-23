import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import AdminPanelV4 from '../app/components/AdminPanelV4';

// AdminPanelV4 is socket-driven: the PartyKit socket is mocked in Storybook
// (no-op, readyState: CLOSED), so server-pushed state (cursors, connected users,
// room config) never arrives. Stories render the static shell and initial local
// state only; play functions test local state transitions that don't require
// server messages.

const meta = {
  title: 'App/AdminPanelV4',
  component: AdminPanelV4,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Admin panel for V4 with 8 tabs: Record, Labels, Anchors, Avatars, Interface, Events, Participants, Moments. Connects to PartyKit over WebSocket; in Storybook the socket is mocked so only the static shell and local-state interactions are testable.',
      },
    },
  },
  tags: ['autodocs'],
  args: { room: 'storybook' },
} satisfies Meta<typeof AdminPanelV4>;

export default meta;
type Story = StoryObj<typeof meta>;

// Record tab is shown on mount by default — no tab click needed.
export const Default: Story = {};

export const RecordTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Record'));
    await expect(canvas.getByText('● Start Recording')).toBeInTheDocument();
  },
};

export const LabelsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Labels'));
    await expect(canvas.getByText(/Reaction labels/)).toBeInTheDocument();
  },
};

export const AnchorsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Anchors'));
    await expect(canvas.getByText(/Anchor positions/)).toBeInTheDocument();
  },
};

export const AvatarsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Avatars'));
    await expect(canvas.getByText(/Avatars are generated/)).toBeInTheDocument();
  },
};

export const InterfacesTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Interface'));
    await expect(canvas.getByText('Social sharing')).toBeInTheDocument();
  },
};

export const EventsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Events'));
    await expect(canvas.getByText('GitHub username submissions')).toBeInTheDocument();
  },
};

export const ParticipantsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('People'));
    await expect(canvas.getByText('Group by:')).toBeInTheDocument();
  },
};

export const MomentsTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Moments'));
    await expect(canvas.getByText('Snap Moment')).toBeInTheDocument();
  },
};

// Local state interaction: clicking "Custom" radio reveals three text inputs.
// Tests that labelSelected state and its conditional render are correctly
// threaded through the component (or its hooks/sub-components after refactor).
export const LabelsCustomInputsReveal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Labels'));
    await userEvent.click(canvas.getByRole('radio', { name: 'Custom' }));
    await expect(canvas.getByPlaceholderText('Positive label')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Negative label')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Neutral label')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Apply Labels' })).toBeDisabled();
  },
};

// Empty state: with mocked socket, githubSubmissions starts as [].
// Tests that the empty message renders and action buttons are correctly disabled.
export const EventsEmptyState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Events'));
    await expect(canvas.getByText(/No submissions yet/)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Download JSON/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Clear/ })).toBeDisabled();
  },
};
