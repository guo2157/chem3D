import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});

await fs.mkdir('docs/screenshots', { recursive: true });
const report = [];

async function inspectOverlaps(page, selectors) {
  return page.evaluate((list) => {
    const rects = list
      .map((selector) => {
        const node = document.querySelector(selector);
        const visible = node && node.getClientRects().length > 0;
        return visible ? { selector, rect: node.getBoundingClientRect().toJSON() } : null;
      })
      .filter(Boolean);
    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].rect; const b = rects[j].rect;
        const overlap = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        if (overlap) overlaps.push([rects[i].selector, rects[j].selector]);
      }
    }
    return overlaps;
  }, selectors);
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button, [role="button"]')];
    const visibleButtons = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(button).visibility !== 'hidden';
    });
    const smallest = Math.min(...visibleButtons.map((button) => {
      const rect = button.getBoundingClientRect();
      return Math.min(rect.width, rect.height);
    }));
    return {
      documentHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      smallestVisibleButton: Number.isFinite(smallest) ? Number(smallest.toFixed(2)) : null,
      viewportHeight: Number(document.querySelector('.viewport')?.getBoundingClientRect().height.toFixed(1) ?? 0),
    };
  });
}

for (const viewport of [
  { name: 'desktop-xl', width: 1920, height: 1080 },
  { name: 'desktop-lg', width: 1366, height: 768 },
  { name: 'tablet-md', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.waitForSelector('.scene-canvas');
  await page.waitForTimeout(600);

  const metricsExplore = await readMetrics(page);
  const overlapsExplore = await inspectOverlaps(page, ['.quick-toolbar', '.camera-controls', '.legend', '.axis-widget', '.viewport-hint', '.mode-switch']);
  await page.screenshot({ path: `docs/screenshots/${viewport.name}-explore.png`, fullPage: true });

  // Pick an atom
  const viewportBox = await page.locator('.viewport').boundingBox();
  const atomSelected = viewportBox
    ? (await (async () => {
        await page.mouse.click(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
        await page.waitForTimeout(150);
        return page.locator('.atom-card').count().then((count) => count > 0);
      })())
    : false;

  // Switch to teach mode via visible control
  let switchErr;
  try {
    if (viewport.width > 430) {
      await page.getByRole('button', { name: '教学', exact: true }).first().click({ timeout: 2000 });
    } else {
      await page.locator('.phone-only').click();
    }
  } catch (error) { switchErr = String(error.message).slice(0, 120); }
  await page.waitForTimeout(400);
  const teachMetrics = await readMetrics(page);
  const overlapsTeach = await inspectOverlaps(page, ['.quick-toolbar', '.step-player', '.lesson-caption', '.camera-controls', '.legend', '.axis-widget', '.mode-switch']);
  await page.screenshot({ path: `docs/screenshots/${viewport.name}-teach.png`, fullPage: true });

  // Try advancing a step via keyboard
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const stepLabel = await page.locator('.step-count').first().textContent().catch(() => null);

  // Switch to classroom mode
  let classroomSwitch;
  try {
    if (viewport.width > 430) {
      await page.getByRole('button', { name: '课堂演示', exact: true }).first().click({ timeout: 2000 });
    } else {
      await page.locator('.phone-only').click();
      await page.locator('.phone-only').click();
    }
    classroomSwitch = true;
  } catch (error) { classroomSwitch = String(error.message).slice(0, 120); }
  await page.waitForTimeout(400);
  const classroomMetrics = await readMetrics(page);
  const overlapsClass = await inspectOverlaps(page, ['.quick-toolbar', '.classroom-header', '.classroom-caption', '.classroom-tools', '.classroom-player']);
  await page.screenshot({ path: `docs/screenshots/${viewport.name}-classroom.png`, fullPage: true });

  report.push({
    viewport: `${viewport.name} ${viewport.width}x${viewport.height}`,
    explore: { ...metricsExplore, overlaps: overlapsExplore },
    atomSelected,
    switchErr,
    teach: { ...teachMetrics, overlaps: overlapsTeach, stepLabel },
    classroom: { ...classroomMetrics, overlaps: overlapsClass, switch: classroomSwitch },
    errors,
  });
  await page.close();
}
console.log(JSON.stringify(report, null, 2));
await browser.close();
