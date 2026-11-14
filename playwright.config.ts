import { defineConfig, devices } from '@playwright/test';

// Phone first (concept v2: "a nine-year-old finishes a game on a phone"), laptop second.
// First run once: npx playwright install chromium
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
