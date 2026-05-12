import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('playwright-artifacts', 'responsive');
const devices = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14-pro', width: 393, height: 852 },
  { name: 'pixel-7', width: 412, height: 915 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'ipad-pro-11', width: 834, height: 1194 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop-fhd', width: 1920, height: 1080 },
];

const routes = ['/', '/player', '/login', '/qr', '/scores', '/solo', '/note-shooter'];

const overlapScript = () => {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const interactive = Array.from(document.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[role="link"]'));
  const visible = interactive.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  });

  const violations = [];
  for (const el of visible) {
    const rect = el.getBoundingClientRect();
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 80);
    const isOut = rect.left < -1 || rect.right > viewportW + 1;
    if (isOut) {
      violations.push({
        type: 'horizontal_overflow',
        tag: el.tagName,
        label,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
      });
    }
  }
  for (const ctrl of visible) {
    const rect = ctrl.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= viewportH) continue;
    const x = Math.floor(Math.min(viewportW - 1, Math.max(0, rect.left + rect.width / 2)));
    const y = Math.floor(Math.min(viewportH - 1, Math.max(0, rect.top + rect.height / 2)));
    const top = document.elementFromPoint(x, y);
    if (top && top !== ctrl && !top.contains(ctrl) && !ctrl.contains(top)) {
      violations.push({
        type: 'covered_interactive',
        tag: ctrl.tagName,
        label: (ctrl.innerText || ctrl.getAttribute('aria-label') || ctrl.getAttribute('placeholder') || ctrl.tagName).trim().slice(0, 80),
        coveredBy: top.tagName,
      });
    }
  }

  const rootScrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
  if (rootScrollWidth > viewportW + 1) {
    violations.push({
      type: 'document_horizontal_overflow',
      viewportW,
      scrollWidth: rootScrollWidth,
    });
  }

  return violations;
};

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

for (const device of devices) {
  const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const url = `${baseURL}${route}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      const violations = await page.evaluate(overlapScript);
      const filename = `${device.name}_${route.replace(/\//g, '_') || 'home'}.png`;
      await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
      report.push({ device: device.name, route, consoleErrors, violations });
    } catch (error) {
      report.push({ device: device.name, route, consoleErrors, violations: [{ type: 'navigation_error', message: String(error) }] });
    } finally {
      await page.close();
    }
  }
  await context.close();
}

await browser.close();

const reportPath = path.join(outDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

const summary = report.map((item) => ({
  device: item.device,
  route: item.route,
  errors: item.consoleErrors.length,
  violations: item.violations.length,
}));

console.table(summary);
console.log(`Saved report: ${reportPath}`);
