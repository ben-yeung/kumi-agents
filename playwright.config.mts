import { defineConfig } from "@playwright/test";
import { createServer } from "node:net";

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** Set E2E_BASE_URL to test a server that is already running. */
const external = process.env.E2E_BASE_URL;
// Workers load this file too, and must all land on the port the runner chose.
process.env.E2E_PORT ??= String(await freePort());
const baseURL = external ?? `http://localhost:${process.env.E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  fullyParallel: true,
  // Long enough for the slowest honest wait: a whole page built at the crew's pace.
  timeout: 150_000,
  // A retry would hide exactly the timing problems these tests exist to catch.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "checks", testIgnore: "shots.spec.ts" },
    { name: "shots", testMatch: "shots.spec.ts", timeout: 240_000 },
  ],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npx next start -p ${process.env.E2E_PORT}`,
        url: baseURL,
        timeout: 180_000,
      },
});
