import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
try {
  readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(line => {
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0 && !line.trimStart().startsWith('#')) {
      const key = line.slice(0, eqIdx).trim()
      const val = line.slice(eqIdx + 1).trim()
      if (key && val && !process.env[key]) process.env[key] = val
    }
  })
} catch { /* env.local not present in CI */ }

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
