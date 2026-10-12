import { expect, test, type Page } from '@playwright/test';
import { sceneTests } from './scene';

async function open(page: Page) {
  await page.goto('/');
  await expect(page.locator('#connection')).toHaveClass(/connected/);
  await expect(page.locator('#viewer canvas')).toBeVisible();
}

const seconds = async (page: Page) => parseFloat((await page.locator('#time').textContent()) ?? '0');
/** Measured angle in degrees for a joint row in the inspector, looked up by its display name. */
const angle = async (page: Page, jointName: string) =>
  parseFloat((await page.locator('.angle-list > div', { hasText: jointName }).locator('[data-angle]').textContent()) ?? 'NaN');

test('loads the model and starts paused with every muscle relaxed', async ({ page }) => {
  await open(page);
  await expect(page.locator('.muscle-row')).toHaveCount(44);
  await expect(page.locator('#model-counts')).toHaveText('29 bone meshes · 23 DOFs · 44 muscle actuators');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  await expect(page.locator('#active-count')).toHaveText('0');
  await expect(page.locator('#selected-id')).toHaveText('FDS2_r');
});

test('excitation produces activation, force, and joint motion while running', async ({ page }) => {
  await open(page);
  // FDS2_r is selected by default and crosses the index MCP.
  const before = await angle(page, 'Index MCP flexion');
  const limitFlag = (joint: string) => page.locator('.angle-list > div', { hasText: joint }).locator('.limit-flag');
  // At rest the fingers are straight, short of their hyperextension limits; the wrist is mid-range.
  await expect(limitFlag('Index PIP flexion')).toBeHidden();
  await expect(limitFlag('Wrist flexion')).toBeHidden();
  await page.locator('#excitation').fill('1');
  await expect(page.locator('#excitation-output')).toHaveText('1.00');
  await expect(page.locator('.muscle-row.selected output')).toHaveText('1.00');
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Running');
  await expect(page.locator('#active-count')).not.toHaveText('0');
  await expect.poll(async () => parseFloat((await page.locator('#activation').textContent()) ?? '0')).toBeGreaterThan(50);
  await expect.poll(() => angle(page, 'Index MCP flexion')).toBeGreaterThan(before + 20);
  // Full FDS2 drives the index PIP and the wrist to their flexion limits; the inspector says so.
  await expect(limitFlag('Index PIP flexion')).toHaveText('At flexion limit');
  await expect(limitFlag('Wrist flexion')).toHaveText('At flexion limit');
});

test('pause freezes simulation time', async ({ page }) => {
  await open(page);
  await page.click('#play');
  await expect.poll(() => seconds(page)).toBeGreaterThan(0.3);
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  const frozen = await seconds(page);
  await page.waitForTimeout(600);
  expect(await seconds(page)).toBe(frozen);
});

test('reset clears excitation, time, and posture', async ({ page }) => {
  await open(page);
  await page.locator('#excitation').fill('0.8');
  await page.click('#play');
  await expect.poll(() => seconds(page)).toBeGreaterThan(0.5);
  await expect.poll(() => angle(page, 'Index PIP flexion')).toBeGreaterThan(10);
  // Pause first: reset keeps the run state, and a running clock restarts at once from zero.
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  await page.click('#reset');
  await expect(page.locator('#excitation-output')).toHaveText('0.00');
  await expect(page.locator('#time')).toHaveText('0.00 s');
  await expect.poll(() => angle(page, 'Index PIP flexion')).toBeLessThan(1);
  for (const slider of await page.locator('[data-slider]').all()) await expect(slider).toHaveValue('0');
});

test('relax all zeroes every command and activation decays', async ({ page }) => {
  await open(page);
  await page.locator('[data-slider="0"]').fill('1');
  await page.locator('[data-slider="3"]').fill('1');
  await page.click('#play');
  await expect(page.locator('#active-count')).toHaveText(/^[2-9]/);
  await page.click('#relax');
  for (const slider of await page.locator('[data-slider]').all()) await expect(slider).toHaveValue('0');
  await expect(page.locator('#active-count')).toHaveText('0');
});

test('selecting a muscle does not activate it', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Extensor carpi ulnaris/ }).click();
  await expect(page.locator('#selected-id')).toHaveText('ECU_r');
  await expect(page.locator('#excitation-output')).toHaveText('0.00');
  await expect(page.locator('.muscle-row.selected')).toHaveCount(1);
  await expect(page.locator('.muscle-row.selected .activation-indicator')).not.toHaveClass(/is-active/);
  // The inspector lists only joints this muscle crosses, with an action direction.
  await expect(page.locator('#influences tbody tr').first()).toBeVisible();
  await expect(page.locator('#influences')).toContainText('Ulnar deviation');
});

test('search and group filter narrow the muscle list', async ({ page }) => {
  await open(page);
  await page.fill('#search', 'pollicis');
  await expect(page.locator('.muscle-row:visible')).not.toHaveCount(0);
  for (const name of await page.locator('.muscle-row:visible .muscle-name').allTextContents()) {
    expect(name.toLowerCase()).toContain('pollicis');
  }
  await page.fill('#search', 'zzz');
  await expect(page.locator('#search-empty')).toBeVisible();
  await page.fill('#search', '');
  await page.selectOption('#group', 'intrinsic_thumb');
  await expect(page.locator('#muscle-count')).not.toHaveText('44 / 44');
});

test('anatomy inventory page is readable and filters by model status', async ({ page, context }) => {
  await open(page);
  await page.locator('summary', { hasText: 'Model scope' }).click();
  const [inventory] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Open anatomy inventory' }).click()]);
  await expect(inventory).toHaveURL(/anatomy\.html$/);
  await expect(inventory.locator('[data-muscle]')).toHaveCount(37);
  await expect(inventory.locator('.totals')).toContainText('Simulated23');
  await expect(inventory.locator('.totals')).toContainText('Approximated11');
  await expect(inventory.locator('.totals')).toContainText('Not in model3');
  await expect(inventory.locator('[data-excluded]')).toHaveCount(2);
  await inventory.click('[data-show="absent"]');
  await expect(inventory.locator('#filter-count')).toHaveText('3 of 37');
  await expect(inventory.locator('[data-muscle="opponens_digiti_minimi"]')).toBeVisible();
  await expect(inventory.locator('[data-muscle="flexor_carpi_radialis"]')).toBeHidden();
  await inventory.click('[data-show="all"]');
  await inventory.fill('#filter-text', 'FDP3');
  await expect(inventory.locator('#filter-count')).toHaveText('1 of 37');
});

test('belly and tendon view shortens only the belly', async ({ page }) => {
  await open(page);
  await page.click('[data-muscle-view="anatomical"]');
  await expect(page.locator('#legend-anatomical')).toBeVisible();
  await expect(page.locator('#legend-paths')).toBeHidden();
  const cm = async (id: string) => parseFloat((await page.locator(id).textContent()) ?? 'NaN');
  await expect.poll(() => cm('#belly-length')).toBeGreaterThan(1);
  const bellyAtRest = await cm('#belly-length');
  const tendonAtRest = await cm('#tendon-length');
  await page.locator('#excitation').fill('1');
  await page.click('#play');
  await expect.poll(() => cm('#belly-length')).toBeLessThan(bellyAtRest - 1);
  expect(await cm('#tendon-length')).toBeCloseTo(tendonAtRest, 1);
  await page.click('[data-muscle-view="paths"]');
  await expect(page.locator('#legend-paths')).toBeVisible();
});

sceneTests(open);
