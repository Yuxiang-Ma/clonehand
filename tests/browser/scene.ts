// 3D highlighting checks shared by the service build (app.spec.ts) and the static demo
// (demo.spec.ts). They compare what the Three.js scene draws with the simulation snapshot it
// was drawn from, read through the window.clonehand hook in src/gui/main.ts.
import { expect, test, type Page } from '@playwright/test';
import type { State } from '../../src/gui/types';

interface DrawnMuscle { id: string; visible: boolean; color: string; opacity: number; outlined: boolean; firstSegment: number[] | null }
interface Scene { view: string; selected: number; state: State; bones: number[][]; muscles: DrawnMuscle[] }

// Path-view colors from src/gui/viewer.ts.
const PATH = { active: '#c85836', selected: '#166b65', resting: '#9b958b' };
const ACTIVE = 0.025;

const scene = (page: Page) => page.evaluate(() => (window as unknown as { clonehand: { scene(): Scene } }).clonehand.scene());

/** Excite FDS2_r fully, select ECU_r (not excited), run until FDS2 is active, then pause. */
async function exciteOneSelectAnother(page: Page) {
  await page.locator('#excitation').fill('1');
  await page.getByRole('button', { name: /Extensor carpi ulnaris/ }).click();
  await expect(page.locator('#selected-id')).toHaveText('ECU_r');
  await page.click('#play');
  const fds2 = (await scene(page)).muscles.findIndex(muscle => muscle.id === 'FDS2_r');
  await expect.poll(async () => (await scene(page)).state.activation[fds2]).toBeGreaterThan(0.5);
  await page.click('#play');
  await expect(page.locator('#run-state')).toHaveText('Paused');
  // Paused snapshots repeat, so the scene settles on one state.
  await expect.poll(async () => { const a = await scene(page); await page.waitForTimeout(150); const b = await scene(page); return a.state.time === b.state.time; }).toBe(true);
  return fds2;
}

/** Pixels in the 3D view that read as the active-muscle red. */
async function redPixels(page: Page) {
  const png = (await page.locator('#viewer canvas').screenshot()).toString('base64');
  return page.evaluate(async data => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      // Lit active paths read brick-red to brown; bone (cream), background, and teal do not pass.
      if (r > 90 && r > g + 30 && r > b + 40) count++;
    }
    return count;
  }, png);
}

export function sceneTests(open: (page: Page) => Promise<void>) {
  test('3D paths are highlighted from simulation activation, separately from selection', async ({ page }) => {
    await open(page);
    const fds2 = await exciteOneSelectAnother(page);
    const drawn = await scene(page);
    const active = drawn.state.activation.map(value => value > ACTIVE);
    expect(active[fds2]).toBe(true);
    expect(drawn.muscles[drawn.selected].id).toBe('ECU_r');
    expect(active[drawn.selected]).toBe(false);
    drawn.muscles.forEach((muscle, index) => {
      const selected = index === drawn.selected;
      expect(muscle.color, muscle.id).toBe(active[index] ? PATH.active : selected ? PATH.selected : PATH.resting);
      expect(muscle.opacity, muscle.id).toBe(active[index] || selected ? 1 : 0.22);
      // Each path is drawn on the simulated route: the first segment sits between the first two
      // wrap points of the same snapshot.
      const [a, b] = drawn.state.paths[index];
      muscle.firstSegment!.forEach((value, axis) => expect(Math.abs(value - (a[axis] + b[axis]) / 2), muscle.id).toBeLessThan(1e-6));
    });
    // The selection outline appears only on an active selected muscle; ECU_r is not active.
    expect(drawn.muscles.some(muscle => muscle.outlined)).toBe(false);
    // Bones are drawn where the simulation put them.
    drawn.bones.forEach((position, index) => position.forEach((value, axis) => expect(Math.abs(value - drawn.state.bone_positions[index][axis])).toBeLessThan(1e-6)));
    // The muscle list and the active count agree with the same snapshot.
    const listed = await page.locator('.muscle-row').evaluateAll(rows => rows.map(row => [Number((row as HTMLElement).dataset.index), row.querySelector('.activation-indicator')!.classList.contains('is-active')] as const));
    for (const [index, isActive] of listed) expect(isActive, drawn.muscles[index].id).toBe(active[index]);
    await expect(page.locator('#active-count')).toHaveText(String(active.filter(Boolean).length));

    // Selecting the active muscle outlines it and keeps the activation color.
    await page.getByRole('button', { name: /Flexor digitorum superficialis · digit 2/ }).click();
    await expect(page.locator('#selected-id')).toHaveText('FDS2_r');
    await expect.poll(async () => (await scene(page)).muscles[fds2].outlined).toBe(true);
    expect((await scene(page)).muscles[fds2].color).toBe(PATH.active);
  });

  test('belly view emphasis follows activation and selection', async ({ page }) => {
    await open(page);
    const fds2 = await exciteOneSelectAnother(page);
    await page.click('[data-muscle-view="anatomical"]');
    await expect.poll(async () => (await scene(page)).view).toBe('anatomical');
    const drawn = await scene(page);
    drawn.muscles.forEach((muscle, index) => {
      const activation = Math.min(1, drawn.state.activation[index]);
      if (index === drawn.selected) {
        expect(muscle.opacity, muscle.id).toBe(1);
        expect(muscle.outlined, muscle.id).toBe(true);
      } else if (activation > ACTIVE) {
        expect(muscle.opacity, muscle.id).toBeCloseTo(0.45 + 0.4 * activation, 5);
      } else {
        expect(muscle.opacity, muscle.id).toBe(0.14);
      }
    });
    // The active belly is red; a relaxed one is not.
    const red = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return r > 1.6 * g && r > 1.6 * b; };
    expect(red(drawn.muscles[fds2].color)).toBe(true);
    expect(red(drawn.muscles[drawn.selected].color)).toBe(false);
  });

  test('activating a muscle turns its path red in the rendered image', async ({ page }) => {
    await open(page);
    // Hide relaxed paths so only the selected and active ones are drawn.
    await page.locator('#all-paths').uncheck();
    await page.waitForTimeout(300);
    // The screenshot includes the legend overlay, whose active swatch is red; that is the baseline.
    const resting = await redPixels(page);
    expect(resting).toBeLessThan(100);
    // Excite FDS2_r, then select another muscle so no selection outline covers the red path.
    await page.locator('#excitation').fill('1');
    await page.getByRole('button', { name: /Extensor carpi ulnaris/ }).click();
    await page.click('#play');
    await expect.poll(() => redPixels(page), { timeout: 15_000 }).toBeGreaterThan(resting + 200);
  });
}
