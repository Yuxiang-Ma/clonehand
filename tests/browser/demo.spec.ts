import { expect, test, type Page } from '@playwright/test';
import { sceneTests } from './scene';

/** Open the demo and fail if it tries to reach the Python service. */
async function open(page: Page) {
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api') || path.startsWith('/ws')) throw new Error(`Demo called the service: ${path}`);
  });
  page.on('websocket', socket => { throw new Error(`Demo opened a WebSocket: ${socket.url()}`); });
  await page.goto('/index.html');
  await expect(page.locator('#connection')).toHaveClass(/connected/);
  await expect(page.locator('#connection-text')).toHaveText('Running locally');
  await expect(page.locator('#viewer canvas')).toBeVisible();
}

const angle = async (page: Page, jointName: string) =>
  parseFloat((await page.locator('.angle-list > div', { hasText: jointName }).locator('[data-angle]').textContent()) ?? 'NaN');

test('runs MyoHand in the browser without the service', async ({ page }) => {
  await open(page);
  await expect(page.locator('.muscle-row')).toHaveCount(39);
  await expect(page.locator('#model-counts')).toHaveText('29 bone meshes · 23 DOFs · 39 muscle actuators');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  await expect(page.locator('#limitations li').first()).toContainText('MUSIC');
  await expect(page.getByRole('button', { name: /Abductor pollicis brevis/ })).toHaveCount(0);
});

test('excitation moves the hand, and pause, relax, and reset work', async ({ page }) => {
  await open(page);
  const before = await angle(page, 'Index MCP flexion');
  await page.locator('#excitation').fill('1');
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Running');
  await expect.poll(async () => parseFloat((await page.locator('#activation').textContent()) ?? '0')).toBeGreaterThan(50);
  await expect.poll(() => angle(page, 'Index MCP flexion')).toBeGreaterThan(before + 20);
  await page.click('#relax');
  await expect(page.locator('#excitation-output')).toHaveText('0.00');
  await expect.poll(async () => parseFloat((await page.locator('#activation').textContent()) ?? '100')).toBeLessThan(5);
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  await page.click('#reset');
  await expect.poll(() => angle(page, 'Index MCP flexion')).toBeCloseTo(before, 0);
  await expect(page.locator('#time')).toHaveText(/^0\.00/);
});

test('anatomy inventory works from static files and marks the MUSIC muscles', async ({ page }) => {
  await page.goto('/anatomy.html');
  await expect(page.locator('[data-muscle]')).toHaveCount(37);
  await expect(page.locator('.totals')).toContainText('Simulated18');
  await expect(page.locator('.totals')).toContainText('Not in model8');
  await expect(page.locator('.totals')).toContainText('Model channels39');
  await expect(page.locator('[data-muscle="abductor_pollicis_brevis"] .status')).toHaveText('Not in model');
  await expect(page.getByText('This browser version runs MyoHand only')).toBeVisible();
});

sceneTests(open);
