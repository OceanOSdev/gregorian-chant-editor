import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  mountDocument,
  openDevFixture,
  scoreOrder,
} from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';

// Pilot subset of docs/verification/divisions/browser-check.mjs on the
// development fixture. See docs/testing.md for what remains legacy-only.
test.use({ baseURL: devOrigin });

// Two punctums ("Al-le") separated by one Minima division `D`.
const twoNeumesWithMinima = {
  title: 'Playwright pilot — divisions',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  neumes: [0, 1].map((i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [{ id: `note${i}`, staffPosition: 2 }],
  })),
  clefChanges: [],
  divisions: [{ id: 'D', kind: 'minima', beforeNeumeId: 'n1' }],
  syllables: [
    { id: 's0', text: 'Al', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    {
      id: 's1',
      text: 'le',
      startsAtNeumeId: 'n1',
      boundaryBefore: 'continuation',
    },
  ],
};

// Fixture setup: centre the target in the viewport (below the sticky tools)
// before native pointer input, as the legacy driver does.
const revealCentered = (locator: Locator) =>
  locator.evaluate((element) =>
    element.scrollIntoView({ block: 'center', inline: 'center' }),
  );

const division = (page: Page) => page.locator('[data-division-id="D"]');
const undo = (page: Page) =>
  page.getByRole('button', { name: 'Undo last edit' });
const redo = (page: Page) =>
  page.getByRole('button', { name: 'Redo last undone edit' });

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
  await mountDocument(page, twoNeumesWithMinima);
  await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
});

for (const width of [1440, 320]) {
  for (const side of ['before', 'after'] as const) {
    test(`pointer places a punctum ${side} a division at ${width}px, then Undo/Redo`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1100 });
      await page
        .getByRole('toolbar', { name: 'Notation tools' })
        .getByRole('button', { name: 'Punctum', exact: true })
        .click();
      const punctumTool = page.locator('button[data-tool="punctum"]');
      await expect(punctumTool).toHaveAttribute('aria-pressed', 'true');

      await revealCentered(division(page));
      const target = await division(page)
        .locator('.score__division-target')
        .boundingBox();
      expect(target).not.toBeNull();
      if (!target) return;
      // Just outside the division's padded hit target, on the chosen side.
      const x = side === 'before' ? target.x - 2 : target.x + target.width + 2;
      const y = target.y + target.height / 2;
      await page.mouse.move(x + 3, y + 3);
      await page.mouse.move(x, y);

      // Before commit, the caret is drawn between the division's ink and the
      // neighbour on the chosen side. It is a zero-width vertical line, so
      // read its client position rather than Playwright visibility.
      const caret = page.locator('.score__placement-caret line').first();
      await expect(caret).toBeAttached();
      const caretX = await caret.evaluate(
        (element) => element.getBoundingClientRect().x,
      );
      const neighbour = await page
        .locator(`[data-neume-id="${side === 'before' ? 'n0' : 'n1'}"]`)
        .boundingBox();
      const ink = await division(page)
        .locator('.score__division-ink')
        .boundingBox();
      expect(neighbour && ink).toBeTruthy();
      if (!neighbour || !ink) return;
      if (side === 'before') {
        expect(caretX).toBeGreaterThanOrEqual(neighbour.x + neighbour.width);
        expect(caretX).toBeLessThanOrEqual(ink.x);
      } else {
        expect(caretX).toBeGreaterThanOrEqual(ink.x + ink.width);
        expect(caretX).toBeLessThanOrEqual(neighbour.x);
      }

      await page.mouse.down();
      await page.mouse.up();

      await expect.poll(() => scoreOrder(page)).toHaveLength(4);
      const placed = await scoreOrder(page);
      expect(placed.indexOf('D')).toBe(side === 'before' ? 2 : 1);
      expect(placed.filter((id) => ['n0', 'D', 'n1'].includes(id))).toEqual([
        'n0',
        'D',
        'n1',
      ]);
      // Lyrics stay anchored to their original neumes.
      await expect(page.locator('.score__lyric')).toHaveCount(2);
      expect(
        await page
          .locator('.score__lyric')
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-syllable-id')),
          ),
      ).toEqual(['s0', 's1']);
      // The placement tool persists after a commit.
      await expect(punctumTool).toHaveAttribute('aria-pressed', 'true');
      // The page itself never scrolls horizontally, including at 320px.
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await page.keyboard.press('Escape');
      await expect(punctumTool).toHaveAttribute('aria-pressed', 'false');
      await undo(page).click();
      await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
      await redo(page).click();
      await expect.poll(() => scoreOrder(page)).toEqual(placed);
    });
  }
}

// KNOWN PRODUCT DEFECT, found by this pilot and escalated rather than fixed
// (plan: no production changes). docs/editor-interactions.md says "In Select,
// click or Enter/Space selects a division". In both browsers, on the dev
// fixture and the production preview, the press focuses the division, the
// Divisions controls mount above the score and push it down (~141 px at
// 1440px), so the release lands elsewhere and no click reaches the division.
// test.fail() keeps the full assertion: it reports an unexpected pass, and
// should then lose this marker, once the product is fixed.
test('pointer click selects a division in Select mode', async ({ page }) => {
  test.fail(
    true,
    'Known defect: press-time Divisions controls shift the score',
  );
  await revealCentered(division(page));
  await division(page).click();
  await expect(division(page)).toBeFocused();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true', {
    timeout: 2_000,
  });
});

test('selected division changes kind with surviving identity and focus through Undo/Redo, then Delete and Undo', async ({
  page,
}) => {
  // Select with the keyboard (see the pointer-selection defect above).
  await division(page).focus();
  await page.keyboard.press('Enter');
  await expect(division(page)).toBeFocused();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('combobox', { name: 'Change division kind' })
    .selectOption('finalis');
  await expect(division(page)).toHaveAttribute('data-division-kind', 'finalis');
  await expect(division(page).locator('.score__division-ink line')).toHaveCount(
    2,
  );

  await undo(page).click();
  await expect(division(page)).toHaveAttribute('data-division-kind', 'minima');
  await expect(division(page).locator('.score__division-ink line')).toHaveCount(
    1,
  );
  await expect(division(page)).toBeFocused();

  await redo(page).click();
  await expect(division(page)).toHaveAttribute('data-division-kind', 'finalis');
  await expect(division(page)).toBeFocused();

  await page.keyboard.press('Delete');
  await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'n1']);
  await undo(page).click();
  // The restored division keeps its original ID and its redone kind.
  await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
  await expect(division(page)).toHaveAttribute('data-division-kind', 'finalis');
});

test('keyboard: Tab traverses note → division → note, Enter selects, Backspace deletes', async ({
  page,
}) => {
  // Fixture setup: start traversal from the first note without selecting it.
  await page.locator('[data-note-id="note0"]').focus();
  await page.keyboard.press('Tab');
  await expect(division(page)).toBeFocused();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Enter');
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Tab');
  await expect(page.locator('[data-note-id="note1"]')).toBeFocused();
  // Tab moves focus without changing the semantic selection.
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Shift+Tab');
  await expect(division(page)).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'n1']);
  await undo(page).click();
  await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
});

for (const side of ['before', 'after'] as const) {
  test(`keyboard: Tab reaches "Insert Punctum ${side} division" and Enter inserts it`, async ({
    page,
  }) => {
    await division(page).focus();
    await page.keyboard.press('Enter');
    const kind = page.getByRole('combobox', { name: 'Change division kind' });
    await expect(kind).toBeVisible();
    await kind.focus();
    await page.keyboard.press('Tab');
    if (side === 'after') await page.keyboard.press('Tab');
    const insert = page.getByRole('button', {
      name: `Insert Punctum ${side} division`,
    });
    await expect(insert).toBeFocused();

    await page.keyboard.press('Enter');
    await expect.poll(() => scoreOrder(page)).toHaveLength(4);
    expect((await scoreOrder(page)).indexOf('D')).toBe(
      side === 'before' ? 2 : 1,
    );
    await undo(page).click();
    await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
  });
}
