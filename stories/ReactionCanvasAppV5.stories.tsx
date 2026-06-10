import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionCanvasAppV5 from '../app/components/apps/ReactionCanvasAppV5';

const meta = {
  title: 'App/ReactionCanvasAppV5',
  component: ReactionCanvasAppV5,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  beforeEach: () => {
    // Bypass mobile-only gate so canvas renders in Storybook on desktop.
    const url = new URL(window.location.href);
    url.searchParams.set('forceView', 'mobile');
    window.history.replaceState({}, '', url.toString());
    return () => {
      const reset = new URL(window.location.href);
      reset.searchParams.delete('forceView');
      window.history.replaceState({}, '', reset.toString());
    };
  },
} satisfies Meta<typeof ReactionCanvasAppV5>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    testConnectionFn: () => Promise.resolve(true),
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    testConnectionFn: () => Promise.resolve(false),
  },
};
