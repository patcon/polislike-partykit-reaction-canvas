import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import GreeterPanel from './component';
import { GreeterConfigProvider } from './useGreeterConfig';

const meta = {
  title: 'Panels/GreeterPanel',
  component: GreeterPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story, ctx) => (
      <div className="v2-app-container" style={{ height: '100vh' }}>
        <GreeterConfigProvider value={{ greeterConfig: (ctx.args as { greeterConfig: { eventUrl: string } | null }).greeterConfig }}>
          <Story />
        </GreeterConfigProvider>
      </div>
    ),
  ],
  args: {
    greeterConfig: null,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unconfigured: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No URL configured yet. Contact the app admin./)).toBeInTheDocument();
  },
};

export const WithBadUrl: Story = {
  args: { greeterConfig: { eventUrl: 'https://example.com' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText(/Unrecognized URL.*Contact the app admin/)).resolves.toBeInTheDocument();
  },
};

export const WithGroupUrl: Story = {
  args: { greeterConfig: { eventUrl: 'https://guild.host/civic-tech-toronto' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('In-Person Attendees')).toBeInTheDocument();
  },
};

export const WithEventUrl: Story = {
  args: { greeterConfig: { eventUrl: 'https://guild.host/events/civic-meetup-542-using-2vakqi' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('In-Person Attendees')).toBeInTheDocument();
  },
};
