import { test, expect } from '@playwright/test';

test('carga el STEP convertido y permite revisar el movimiento y las piezas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const viewer = page.locator('[data-viewer]');
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(viewer).toHaveAttribute('data-meshes', '15');
  await expect(page.locator('#opening-value')).toHaveText('22°');
  await page.getByRole('button', { name: 'Cerrar mueble' }).click();
  await expect(viewer).toHaveAttribute('data-angle', '0');
  await page.getByRole('button', { name: 'Abrir mueble' }).click();
  await expect(viewer).toHaveAttribute('data-angle', '30');
  await page.getByRole('button', { name: 'Despiece', exact: false }).click();
  await expect(viewer).toHaveAttribute('data-exploded', 'true');
  await page.getByRole('button', { name: 'Desagüe', exact: false }).click();
  await expect(viewer).toHaveAttribute('data-context', 'true');
  await page.getByRole('button', { name: 'Medidas', exact: false }).click();
  await expect(viewer).toHaveAttribute('data-dimensions', 'true');
  await page.getByRole('button', { name: 'Grafito', exact: true }).click();
  await expect(page.locator('#finish-label')).toHaveText('Grafito');
  await page.getByRole('button', { name: 'Superior', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-camera', 'top');
  await page.getByRole('button', { name: 'Restablecer vista' }).click();
  await expect(viewer).toHaveAttribute('data-angle', '22');
  await expect(viewer).toHaveAttribute('data-context', 'false');
  await expect(viewer).toHaveAttribute('data-exploded', 'false');
  await expect(page.getByRole('button', { name: 'Desagüe', exact: false })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Medidas', exact: false })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Roble natural', exact: true }).click();
  await page.locator('#coleccion').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/catalog-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('el catálogo funciona en móvil sin desbordar y el STEP se puede descargar', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/muebles/basurero-doble/');
  await expect(page.locator('[data-viewer]')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar modelo STEP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('basurero-doble.step');
  expect(await download.failure()).toBeNull();
  const step = await request.get('/models/basurero-doble/basurero-doble.step');
  expect(step.ok()).toBe(true);
  expect(await step.text()).toContain('ISO-10303-21;');
  await page.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
});

test('un fallo de carga conserva la ficha y explica cómo acceder al diseño', async ({ page }) => {
  await page.route('**/basurero-doble.mesh.json', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.locator('.viewer-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Descargar modelo STEP' })).toBeVisible();
});
