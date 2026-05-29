import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import SocialMediaPanel from '../app/components/panels/SocialMediaPanel';
import { SocialMediaConfigProvider } from '../app/context/PanelConfigs';
import type { SocialConfig } from '../app/types';

const EMPTY_CONFIG: SocialConfig = { default: '', twitter: '', bluesky: '', mastodon: '', instagram: '' };
const FULL_CONFIG: SocialConfig = {
  default: 'Check out this event!',
  twitter: '#awesome',
  bluesky: '',
  mastodon: '',
  instagram: '',
};

const meta = {
  title: 'Panels/SocialMediaPanel',
  component: SocialMediaPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story, ctx) => (
      <div className="v2-app-container" style={{ height: '100vh' }}>
        <SocialMediaConfigProvider value={{ socialMediaConfig: (ctx.args as { socialMediaConfig: SocialConfig | null }).socialMediaConfig }}>
          <Story />
        </SocialMediaConfigProvider>
      </div>
    ),
  ],
  args: {
    socialMediaConfig: null,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unconfigured: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No social sharing links configured yet/)).toBeInTheDocument();
  },
};

export const EmptyConfig: Story = {
  args: { socialMediaConfig: EMPTY_CONFIG },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No social sharing links configured yet/)).toBeInTheDocument();
  },
};

export const WithTwitterConfig: Story = {
  args: { socialMediaConfig: FULL_CONFIG },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // default text applies to all platforms, so all four buttons appear
    await expect(canvas.getByText('Share to Twitter / X')).toBeInTheDocument();
    await expect(canvas.getByText('Share to Bluesky')).toBeInTheDocument();
    await expect(canvas.getByText('Share on Mastodon')).toBeInTheDocument();
    await expect(canvas.getByText('Open Instagram')).toBeInTheDocument();
  },
};
