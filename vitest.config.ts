import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts', 'party/**/*.test.ts', 'plugins/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'components',
          include: ['tests/**/*.test.tsx', 'plugins/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup.tsx'],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: [],
        },
      },
    ],
  },
});
