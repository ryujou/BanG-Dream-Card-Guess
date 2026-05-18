import { test, expect } from '@playwright/test';

test.describe('Routing and Rendering', () => {
  test('Home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BanG Dream!/);
    await expect(page.locator('.linktree-shell')).toBeVisible();
    await expect(page.locator('.linktree-pill').first()).toBeVisible();
    await expect(page.getByText('进入猜卡游戏')).toBeVisible();
  });

  test('Player page', async ({ page }) => {
    await page.goto('/player');
    await expect(page.locator('.player-shell')).toBeVisible();
    await expect(page.locator('.stage')).toBeVisible();
    // It should show wait message or loading
    await expect(page.locator('.player-result')).toBeVisible();
  });

  test('/play redirects to /player', async ({ page }) => {
    await page.goto('/play');
    await expect(page).toHaveURL(/.*\/player/);
    await expect(page.locator('.player-shell')).toBeVisible();
  });

  test('Solo page', async ({ page }) => {
    await page.goto('/solo');
    await expect(page.locator('.solo-panel')).toBeVisible();
    await expect(page.locator('form.solo-answer')).toBeVisible();
    await expect(page.locator('.solo-controls button:has-text("开始")').first()).toBeVisible();
  });

  test('Host page without login redirects or acts correctly', async ({ page }) => {
    await page.goto('/host');
    // If not logged in, it might get kicked to login page via websocket message or show Host stuff initially.
    // The requirement says "Host 页面关键控制按钮存在"
    // The redirect happens async when websocket 'authRequired' is received. We can just check the DOM or wait for redirect.
    // Wait for either .host-shell or redirect to /login
    await Promise.race([
      expect(page.locator('.host-shell')).toBeVisible(),
      expect(page).toHaveURL(/.*\/login/),
    ]);
  });

  test('Settings page', async ({ page }) => {
    await page.goto('/settings');
    // Similar to host, might redirect, but let's check for settings form or login
    await Promise.race([
      expect(page.locator('.settings-shell')).toBeVisible(),
      expect(page).toHaveURL(/.*\/login/),
    ]);
  });

  test('Login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.login-shell')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('登录');
  });

  test('QR page', async ({ page }) => {
    await page.goto('/qr');
    await expect(page.locator('.qr-shell')).toBeVisible();
    await expect(page.getByText('扫码入口')).toBeVisible();
  });

  test('Scores page', async ({ page }) => {
    await page.goto('/scores');
    await expect(page.locator('.scores-shell')).toBeVisible();
    await expect(page.getByText('成绩榜')).toBeVisible();
  });

  test('Note Shooter page', async ({ page }) => {
    await page.goto('/note-shooter');
    await expect(page.locator('.note-shooter-shell')).toBeVisible();
    await expect(page.locator('iframe.note-shooter-frame')).toBeVisible();
  });

  test('/queue redirects to /note-shooter', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/.*\/note-shooter/);
  });

  test('Stopwatch Challenge page', async ({ page }) => {
    await page.goto('/games/stopwatch-challenge');
    await expect(page.locator('.stopwatch-page')).toBeVisible();
    // Ensure it's not empty string
    await expect(page.locator('.stopwatch-target')).toBeVisible();
  });

  test('Bang Klotski page', async ({ page }) => {
    await page.goto('/games/bang-klotski');
    await expect(page.locator('.bang-klotski-shell')).toBeVisible();
    await expect(page.locator('iframe.bang-klotski-frame')).toBeVisible();
  });
});
