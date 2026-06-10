import type { Meta, StoryObj } from '@storybook/react-vite';
import { NewFrontPage } from '../app/components/NewFrontPage';

const meta = {
  title: 'Pages/NewFrontPage',
  component: NewFrontPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof NewFrontPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
