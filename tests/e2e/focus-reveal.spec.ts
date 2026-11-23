import { expect, test, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';
import { punctumScore } from './helpers/punctum-score.ts';
import { frames, selectedNoteId } from './helpers/score.ts';

// Native Tab/Shift+Tab focus is minimally revealed below the sticky tools
// without changing selection, and visible focus never scrolls. Contract:
// docs/editor-interactions.md, "Focus".
test.use({ baseURL: devOrigin });

const note = (page: Page, index: number) =>
  page.locator(`[data-note-id="note${index}"]`);
const stickyBottom = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector('.editor-sticky-toolbar')?.getBoundingClientRect()
        .bottom ?? Number.NaN,
  );
// getBoundingClientRect, which the reveal itself uses. (Playwright's
// boundingBox reads CDP box quads in Chromium, about 1.5 px taller here.)
const topOf = (page: Page, index: number) =>
  note(page, index).evaluate((element) => element.getBoundingClientRect().top);

// Fixture setup: focus a note without scrolling, then scroll the window so
// note50's top is 80 px below the top of the window (under the sticky tools)
// or in the middle. Programmatic focus schedules its own reveal for the next
// frame, so let that run before scrolling.
async function startAt(page: Page, start: number, offset: string) {
  await note(page, start).evaluate((element) =>
    (element as SVGElement).focus({ preventScroll: true }),
  );
  await frames(page);
  await note(page, 50).evaluate((element, offsetExpression) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    const offset = offsetExpression === 'middle' ? window.innerHeight / 2 : 80;
    window.scrollTo(0, top - offset);
  }, offset);
  await frames(page);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await openDevFixture(page);
  await mountDocument(page, punctumScore(100));
});

for (const reverse of [false, true]) {
  const key = reverse ? 'Shift+Tab' : 'Tab';
  test(`native ${key} reveals a note covered by the sticky tools without changing selection`, async ({
    page,
  }) => {
    await startAt(page, reverse ? 51 : 49, 'covered');
    // Precondition: the destination starts under the sticky tools.
    expect(await topOf(page, 50)).toBeLessThan(await stickyBottom(page));
    const selected = await selectedNoteId(page);

    await page.keyboard.press(key);
    await expect(note(page, 50)).toBeFocused();
    // The reveal margin is 8 px; allow 1 px for subpixel layout.
    await expect
      .poll(async () => (await topOf(page, 50)) - (await stickyBottom(page)))
      .toBeGreaterThanOrEqual(7);
    expect(await selectedNoteId(page)).toBe(selected);
  });
}

test('native Tab to a visible note does not scroll', async ({ page }) => {
  await startAt(page, 49, 'middle');
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Tab');
  await expect(note(page, 50)).toBeFocused();
  // The reveal runs in an animation frame after focus; wait for it.
  await frames(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});
