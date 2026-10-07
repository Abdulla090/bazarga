// Mobile layout checks against a running production build with the demo seed (see e2e/support.mjs).
//   npm run build && npm run db:setup && npm start   (other shell)
//   BASE_URL=http://localhost:3000 [CHROMIUM_PATH=/usr/bin/chromium] npm run test:mobile
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
