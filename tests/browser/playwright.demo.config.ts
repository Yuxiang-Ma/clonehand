import { defineConfig } from '@playwright/test';

// The static web demo: no Python service, just files. MuJoCo runs in the browser.
const port = Number(process.env.CLONEHAND_DEMO_PORT ?? 8766);

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    // A plain static file server, as any web host would be.
    command: `npm run build:demo && .venv/bin/python -m http.server ${port} --bind 127.0.0.1 --directory dist-demo`,
    cwd: '../..',
    url: `http://127.0.0.1:${port}/index.html`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
