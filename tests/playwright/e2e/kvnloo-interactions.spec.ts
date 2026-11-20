import { expect, test, type Locator } from '@playwright/test';

test.skip(process.env.FRAMEWORK !== 'react', 'Patch Lab is a React example');

async function center(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function wirePoint(locator: Locator, fraction: number) {
  return locator.evaluate((element, t) => {
    const path = element as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * t).matrixTransform(path.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, fraction);
}

test('captures a compatible drop, cinches three selected wires, and unties them', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/kvnloo-interactions');
  const canvas = page.getByRole('region', { name: 'Patch canvas' });
  const status = canvas.locator('[aria-live="polite"].kv-status');
  await expect(status).toContainText('2 wires');
  const spare = await center(page.getByLabel('Source deck Signal'));
  const input = await center(page.getByLabel('Mix bus Signal'));
  const wrong = await center(page.getByLabel('Mix bus Image'));

  await page.mouse.move(spare.x, spare.y);
  await page.mouse.down();
  await page.mouse.move(wrong.x, wrong.y, { steps: 12 });
  await page.mouse.up();
  await expect(status).toContainText('2 wires');

  await page.mouse.move(spare.x, spare.y);
  await page.mouse.down();
  await page.mouse.move(input.x - 38, input.y + 6, { steps: 12 });
  await expect(canvas.locator('[data-magnet="captured"]')).toBeVisible();
  const halo = await center(canvas.locator('.kv-halo circle').first());
  expect(Math.hypot(halo.x - input.x, halo.y - input.y)).toBeLessThan(2);
  await canvas.screenshot({ path: testInfo.outputPath('magnet.png') });
  await page.mouse.up();
  await expect(canvas.locator('.kv-snap-ring')).toHaveCount(1);
  await expect(status).toContainText('3 wires');

  const paths = canvas.locator('.kv-wire-path');
  const pathsBefore = await paths.evaluateAll((wires) => wires.map((path) => path.getAttribute('d')));
  for (const port of ['Image', 'Control', 'Signal']) {
    const p = await wirePoint(canvas.locator(`[data-wire="${port}"] .kv-wire-path`), 0.5);
    await page.keyboard.down('Shift');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Shift');
  }
  await expect(status).toContainText('3 selected');
  await canvas.getByRole('button', { name: 'Tie up' }).click();
  await expect(status).toContainText('3 bundled');
  await expect(canvas.locator('[data-bundle-clamp]')).toHaveCount(1);
  await expect(canvas.locator('[data-signal-bead]')).toHaveCount(3);
  const pathsAfter = await paths.evaluateAll((wires) => wires.map((path) => path.getAttribute('d')));
  expect(pathsAfter).not.toEqual(pathsBefore);
  await page.screenshot({ path: testInfo.outputPath('bundle.png') });

  await canvas.getByRole('button', { name: 'Untie' }).click();
  await expect(canvas.locator('[data-bundle-clamp]')).toHaveCount(0);
  await expect(canvas.locator('[data-signal-bead]')).toHaveCount(0);
  await expect
    .poll(() => paths.evaluateAll((wires) => wires.map((path) => path.getAttribute('d'))))
    .toEqual(pathsBefore);
  await expect(status).toContainText('3 wires');
  await page.screenshot({ path: testInfo.outputPath('untied.png') });
  expect(errors).toEqual([]);
});

test('floating cable follows the node border and reduced motion skips the beads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/examples/kvnloo-interactions');
  const edge = page.locator('path[id="scope-monitor"].react-flow__edge-path');
  await expect(edge).toBeVisible();
  const before = await edge.getAttribute('d');
  const scope = await center(page.getByText('Scope', { exact: true }));
  await page.mouse.move(scope.x, scope.y);
  await page.mouse.down();
  await page.mouse.move(scope.x + 100, scope.y - 40, { steps: 8 });
  await page.mouse.up();
  await expect(edge).not.toHaveAttribute('d', before!);
  await page.getByRole('button', { name: 'Select wires' }).click();
  await page.getByRole('button', { name: 'Tie up' }).click();
  await expect(page.locator('[data-bundle-clamp]')).toHaveAttribute('opacity', '1');
  await expect(page.locator('[data-signal-bead]')).toHaveCount(0);
});
