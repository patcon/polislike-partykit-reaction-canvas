import type { Meta, StoryObj } from '@storybook/react-vite';
import Counter from '../app/components/Counter';

// Counter is a legacy example component from the PartyKit starter template.
// It connects to a socket to sync a shared count; in Storybook the socket is
// mocked so the count won't update from the server, but the button renders
// and the click handler runs (optimistic local increment is wired up).

const meta = {
  title: 'App/Counter',
  component: Counter,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Counter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
