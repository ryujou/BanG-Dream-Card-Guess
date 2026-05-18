import { test, expect } from '@playwright/test';

test.describe('Diagnostics page', () => {
  test('opens and shows runtime information controls', async ({ page }) => {
    await page.goto('/diagnostics');
    await expect(page.locator('.diagnostics-shell')).toBeVisible();
    await expect(page.getByRole('heading', { name: '运行诊断' })).toBeVisible();
    await expect(page.getByRole('button', { name: '复制诊断信息' })).toBeVisible();
    await expect(page.locator('.diagnostics-grid article').first()).toBeVisible();
  });
});
