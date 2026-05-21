import { expect, test, devices, type Page } from '@playwright/test';

const tabs = ['Direct', 'À voter', 'Studio', 'Palmarès', 'Trophées'] as const;

test.use({ ...devices['iPhone 15 Pro'] });

function tabNameMatcher(label: string) {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
}

async function assertNoHorizontalBreakage(page: Page) {
  const report = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const visibleOffenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return false;
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }));

    const clippedControls = Array.from(document.querySelectorAll<HTMLElement>('button, nav span, .gold-pill'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));

    return { viewportWidth, documentWidth, visibleOffenders, clippedControls };
  });

  expect(report.documentWidth, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(report.viewportWidth + 1);
  expect(report.visibleOffenders, JSON.stringify(report.visibleOffenders, null, 2)).toEqual([]);
  expect(report.clippedControls, JSON.stringify(report.clippedControls, null, 2)).toEqual([]);
}

test('interface prestige dense sans débordement horizontal sur iPhone 15 Pro', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: tabNameMatcher('Direct') }).last()).toBeVisible();

  for (const tab of tabs) {
    await page.getByRole('button', { name: tabNameMatcher(tab) }).last().click();
    await page.waitForTimeout(250);
    await assertNoHorizontalBreakage(page);
  }
});
