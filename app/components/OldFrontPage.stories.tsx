import type { Meta, StoryObj } from '@storybook/react-vite';
import { OldFrontPage } from './OldFrontPage';

const meta = {
  title: 'Pages/OldFrontPage',
  component: OldFrontPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof OldFrontPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
