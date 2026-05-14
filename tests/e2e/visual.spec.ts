import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  // Common style to hide/mask dynamic elements (timers, scores, variable content)
  const maskSelectors = [
    '.timer span', 
    '.scoreboard span', 
    '.score-live-meta span',
    '.score-rank-list b',
    '.score-rank-list em',
    '.score-recent-list b',
    '.score-recent-list span',
    '.qr-lan code',
    '.wifi-qr img',
    '.wifi-qr code',
    '.qr-card img',
    '.qr-card code',
    '.linktree-event-list .event-date',
    '.linktree-gallery img',
    '.live-dot' // Mask the blinking dot to prevent subtle diffs
  ];

  const screenshotOptions = (page: any) => ({
    mask: maskSelectors.map(s => page.locator(s)),
    maxDiffPixelRatio: 0.05,
    animations: 'disabled' as const
  });

  test('Home page', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('.linktree-shell');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('home.png', screenshotOptions(page));
  });

  test('Player page', async ({ page }) => {
    await page.goto('/player');
    const shell = page.locator('.player-shell');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('player.png', screenshotOptions(page));
  });

  test('Solo page', async ({ page }) => {
    await page.goto('/solo');
    const shell = page.locator('.solo-panel');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('solo.png', screenshotOptions(page));
  });

  test('Host page', async ({ page }) => {
    await page.goto('/login');
    const loginShell = page.locator('.login-shell');
    await loginShell.waitFor();
    await expect(loginShell).toHaveScreenshot('login.png', screenshotOptions(page));
  });

  test('Settings page', async ({ page }) => {
    await page.route('/api/network', async route => {
        await route.fulfill({ json: { appMode: 'booth', entries: [] } });
    });
    
    await page.goto('/login');
  });

  test('QR page', async ({ page }) => {
    await page.goto('/qr');
    const shell = page.locator('.qr-shell');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('qr.png', screenshotOptions(page));
  });

  test('Scores page', async ({ page }) => {
    await page.goto('/scores');
    const shell = page.locator('.scores-shell');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('scores.png', screenshotOptions(page));
  });

  test('Stopwatch Challenge page', async ({ page }) => {
    await page.goto('/games/stopwatch-challenge');
    const shell = page.locator('.stopwatch-page');
    await shell.waitFor();
    await expect(shell).toHaveScreenshot('stopwatch.png', screenshotOptions(page));
  });
});
