import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4321',
    headless: true,
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    ...devices['Desktop Chrome'],
  },
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'pnpm exec astro preview --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
  },
});
