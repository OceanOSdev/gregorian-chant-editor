import { expect, test, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';
import { punctumScore } from './helpers/punctum-score.ts';
import { pageIsContained, scoreOrder } from './helpers/score.ts';

// Rendered division layout on the development fixture: legal score shapes,
// reflow, local overflow and the measured lyric/bar clearance. Contract:
// docs/layout-and-rendering.md, "Stage 5B divisions and score slots".
test.use({ baseURL: devOrigin });

const division = (page: Page, id = 'D') =>
  page.locator(`[data-division-id="${id}"]`);
const systemCount = (page: Page) =>
  page
    .locator('[data-system-index]')
    .evaluateAll(
      (elements) =>
        new Set(elements.map((e) => e.getAttribute('data-system-index'))).size,
    );

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
});

// Leading and adjacent bars before the first neume, a trailing finalis, a
// division-only score and a score that wraps onto several systems.
for (const count of [0, 1, 20]) {
  test(`leading, adjacent and trailing divisions render in order and are focusable with ${count} neumes at 320px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 1100 });
    const chant = punctumScore(count);
    const first = chant.neumes[0]?.id ?? null;
    chant.syllables = [];
    chant.divisions = [
      { id: 'a', kind: 'minima', beforeNeumeId: first },
      { id: 'b', kind: 'minor', beforeNeumeId: first },
      { id: 'z', kind: 'finalis', beforeNeumeId: null },
    ];
    await mountDocument(page, chant);
    await expect
      .poll(() => scoreOrder(page))
      .toEqual(['a', 'b', ...chant.neumes.map((neume) => neume.id), 'z']);
    if (count === 20) expect(await systemCount(page)).toBeGreaterThan(1);
    for (const id of ['a', 'b', 'z']) {
      await division(page, id).focus();
      await expect(division(page, id)).toBeFocused();
    }
    expect(await pageIsContained(page)).toBe(true);
  });
}

test('a focused division keeps focus when 150% CSS zoom reflows a score with outgoing marks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1100 });
  const chant = punctumScore(40);
  chant.divisions = [{ id: 'D', kind: 'finalis', beforeNeumeId: 'n10' }];
  chant.syllables[1].startsAtNeumeId = 'n38';
  await mountDocument(page, chant);
  expect(await systemCount(page)).toBeGreaterThan(1);
  const inkHeight = async () =>
    (await division(page).locator('.score__division-ink').boundingBox())
      ?.height ?? 0;
  const heightBefore = await inkHeight();
  await division(page).focus();
  await expect(division(page)).toBeFocused();

  // Fixture setup: CSS zoom on the application, as in the CSS-zoom record.
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) throw Error('Missing main');
    main.style.zoom = '1.5';
  });
  // The zoom took effect on the rendered score (re-measured and re-scaled).
  await expect.poll(inkHeight).not.toBeCloseTo(heightBefore, 0);
  await expect(division(page)).toBeFocused();
  await expect(page.locator('[data-outgoing="true"]').first()).toBeAttached();
});

test('an oversized lyric scrolls the score locally, and a pointer click selects a division after scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1100 });
  const chant = punctumScore();
  chant.syllables[0].text = 'a'.repeat(180);
  await mountDocument(page, chant);
  expect(
    await page
      .locator('.score-viewport')
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  expect(await pageIsContained(page)).toBe(true);

  // Native click: Playwright scrolls the division into view, including the
  // score viewport, before pressing.
  await division(page).locator('.score__division-target').click();
  await expect(division(page)).toBeFocused();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
});

// PR #48: measured lyric glyph extents clear both sides of a bar by the
// documented 16 units, for word and continuation boundaries, at desktop and
// narrow widths. Short/long pairs and oversized syllables that wrap.
const clearancePairs = [
  [35, 2],
  [2, 35],
  [50, 50],
  [180, 180],
] as const;
for (const width of [1440, 320]) {
  for (const boundaryBefore of ['word', 'continuation'] as const) {
    for (const [before, after] of clearancePairs) {
      test(`lyrics clear a division by 16 units: ${boundaryBefore} boundary, ${before}/${after} letters at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1100 });
        const chant = punctumScore(3);
        chant.syllables[0].text = 'a'.repeat(before);
        chant.syllables[1].text = 'a'.repeat(after);
        chant.syllables[1].boundaryBefore = boundaryBefore;
        await mountDocument(page, chant);
        await expect
          .poll(() => scoreOrder(page))
          .toEqual(['n0', 'D', 'n1', 'n2']);

        // SVG user units from getBBox, compared against the division ink's
        // stroke edges (strokes are 1.5 units wide). A lyric on another
        // system does not constrain this bar.
        const clearance = await division(page).evaluate((bar) => {
          const system = bar.closest('[data-system-index]');
          const ink = bar
            .querySelector<SVGGraphicsElement>('.score__division-ink')
            ?.getBBox();
          if (!system || !ink) throw Error('Missing division ink or system');
          const lyric = (id: string) =>
            system
              .querySelector<SVGGraphicsElement>(`[data-syllable-id="${id}"]`)
              ?.getBBox();
          const source = lyric('s0');
          const target = lyric('s1');
          return {
            before: source ? ink.x - 0.75 - (source.x + source.width) : null,
            after: target ? target.x - (ink.x + ink.width) - 0.75 : null,
          };
        });
        expect(
          clearance.before !== null || clearance.after !== null,
          'at least one lyric shares the division’s system',
        ).toBe(true);
        if (clearance.before !== null)
          expect(clearance.before).toBeGreaterThanOrEqual(15.9);
        if (clearance.after !== null)
          expect(clearance.after).toBeGreaterThanOrEqual(15.9);
        expect(await pageIsContained(page)).toBe(true);
      });
    }
  }
}
