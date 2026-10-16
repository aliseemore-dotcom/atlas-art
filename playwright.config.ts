import { defineConfig, devices } from "@playwright/test";

// В окружениях без загрузки браузеров укажите PLAYWRIGHT_CHROMIUM_PATH (иначе используется браузер Playwright).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3100", launchOptions },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, launchOptions } },
  ],
});
