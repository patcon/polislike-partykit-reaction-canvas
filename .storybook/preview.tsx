import type { Preview } from '@storybook/react-vite'
import '../app/styles.css'
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext';

const preview: Preview = {
  decorators: [
    (Story) => (
      <RoomSocketProvider room="storybook" userId="story-user">
        <Story />
      </RoomSocketProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
      // Suppress the "You modified this story. Do you want to save your
      // changes?" banner — it overlaps the bottom of the Controls panel and
      // was hiding the last row(s) of controls (e.g. dynamism) on tall arg lists.
      disableSaveFromUI: true,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;
