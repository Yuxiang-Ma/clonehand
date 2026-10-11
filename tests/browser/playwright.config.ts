import { defineConfig } from '@playwright/test';

const port = Number(process.env.CLONEHAND_TEST_PORT ?? 8765);

export default defineConfig({
  testDir: '.',
  testMatch: 'app.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Headless Chromium has no GPU; SwiftShader provides WebGL for Three.js.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    // FastAPI serves the production build from dist/, so build first.
    command: `npm run build && .venv/bin/uvicorn src.server:app --host 127.0.0.1 --port ${port}`,
    cwd: '../..',
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
