import { expect, test, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';
import { punctumScore, type PunctumScore } from './helpers/punctum-score.ts';
import {
  pageIsContained,
  revealCentered,
  scoreOrder,
} from './helpers/score.ts';

// Division placement, selection, editing and Division-menu workflows on the
// development fixture. Contract: docs/editor-interactions.md, "Stage 5B
// division controls". Layout and clearance: division-layout.spec.ts.
test.use({ baseURL: devOrigin });

const widths = [1440, 320] as const;
const sides = ['before', 'after'] as const;
type Side = (typeof sides)[number];

const division = (page: Page, id = 'D') =>
  page.locator(`[data-division-id="${id}"]`);
const tools = (page: Page) =>
  page.getByRole('toolbar', { name: 'Notation tools' });
const punctumTool = (page: Page) =>
  tools(page).locator('button[data-tool="punctum"]');
// The Division split control: its primary arms Minima, its arrow opens the
// four-kind menu and exposes the armed kind as data-active-variant.
const divisionPrimary = (page: Page) =>
  tools(page).locator('button[data-tool="minima"]');
const divisionArrow = (page: Page) =>
  tools(page).getByRole('button', { name: /^Division family variants/ });
const divisionMenu = (page: Page) =>
  page.getByRole('menu', { name: 'Division family' });
const kindNames = {
  minima: 'Minima',
  minor: 'Minor',
  maior: 'Maior',
  finalis: 'Finalis',
} as const;
const undo = (page: Page) =>
  page.getByRole('button', { name: 'Undo last edit' });
const redo = (page: Page) =>
  page.getByRole('button', { name: 'Redo last undone edit' });
const indexOfD = async (page: Page) => (await scoreOrder(page)).indexOf('D');

async function mount(page: Page, width: number, chant?: PunctumScore) {
  await page.setViewportSize({ width, height: 1100 });
  await mountDocument(page, chant ?? punctumScore());
}

async function selectDivisionByPointer(page: Page) {
  await revealCentered(division(page));
  await division(page).click();
  await expect(division(page)).toBeFocused();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
}

const systemOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate(
      (element) =>
        element
          .closest('[data-system-index]')
          ?.getAttribute('data-system-index') ?? null,
    );

// Hovers just outside the division's padded hit target on one side, checks
// the caret is drawn on the division's system between its ink and that side's
// neighbour (when the neighbour shares the system), then commits with a
// native click.
async function placePunctumBeside(page: Page, side: Side) {
  await revealCentered(division(page));
  const target = await division(page)
    .locator('.score__division-target')
    .boundingBox();
  expect(target).not.toBeNull();
  if (!target) return;
  const x = side === 'before' ? target.x - 2 : target.x + target.width + 2;
  const y = target.y + target.height / 2;
  await page.mouse.move(x + 3, y + 3);
  await page.mouse.move(x, y);

  // The caret is a zero-width vertical line, so read its client position
  // rather than Playwright visibility.
  const caret = page.locator('.score__placement-caret line').first();
  await expect(caret).toBeAttached();
  const caretBox = await caret.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, top: box.top, bottom: box.bottom };
  });
  const neighbourSelector = `[data-neume-id="${side === 'before' ? 'n0' : 'n1'}"]`;
  const neighbour = await page.locator(neighbourSelector).boundingBox();
  const ink = await division(page)
    .locator('.score__division-ink')
    .boundingBox();
  expect(neighbour && ink).toBeTruthy();
  if (!neighbour || !ink) return;
  // Same system: the caret spans the division's ink vertically.
  expect(caretBox.top).toBeLessThanOrEqual(ink.y + ink.height);
  expect(caretBox.bottom).toBeGreaterThanOrEqual(ink.y);
  const sameSystem =
    (await systemOf(page, neighbourSelector)) ===
    (await systemOf(page, '[data-division-id="D"]'));
  if (side === 'before') {
    if (sameSystem)
      expect(caretBox.x).toBeGreaterThanOrEqual(neighbour.x + neighbour.width);
    expect(caretBox.x).toBeLessThanOrEqual(ink.x);
  } else {
    expect(caretBox.x).toBeGreaterThanOrEqual(ink.x + ink.width);
    if (sameSystem) expect(caretBox.x).toBeLessThanOrEqual(neighbour.x);
  }

  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => scoreOrder(page)).toHaveLength(4);
  expect(await indexOfD(page)).toBe(side === 'before' ? 2 : 1);
}

// A point on the first system's staff, past the last rendered item, where
// hovering with a placement tool armed previews an insertion at the end.
async function pointPastLastItem(page: Page) {
  await revealCentered(page.locator('.score__staff-line').first());
  const last = await page
    .locator('[data-neume-id], [data-division-id]')
    .last()
    .boundingBox();
  const lines = await page
    .locator('.score__staff-line')
    .evaluateAll((elements) =>
      elements.slice(0, 4).map((element) => {
        const box = element.getBoundingClientRect();
        return box.y + box.height / 2;
      }),
    );
  expect(last).not.toBeNull();
  if (!last) throw Error('No rendered score item');
  return { x: last.x + last.width + 20, y: (lines[1] + lines[2]) / 2 };
}

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
});

test.describe('pointer placement beside a division', () => {
  for (const width of widths) {
    for (const side of sides) {
      test(
        `places a punctum ${side} a division at ${width}px, then Undo/Redo`,
        // Hosted CI smoke: one pointer placement (see docs/testing.md).
        { tag: width === 1440 && side === 'before' ? ['@smoke'] : [] },
        async ({ page }) => {
          await mount(page, width);
          await tools(page)
            .getByRole('button', { name: 'Punctum', exact: true })
            .click();
          await expect(punctumTool(page)).toHaveAttribute(
            'aria-pressed',
            'true',
          );

          await placePunctumBeside(page, side);
          const placed = await scoreOrder(page);
          expect(placed.filter((id) => ['n0', 'D', 'n1'].includes(id))).toEqual(
            ['n0', 'D', 'n1'],
          );
          // Lyrics stay anchored to their original neumes.
          expect(
            await page
              .locator('.score__lyric')
              .evaluateAll((elements) =>
                elements.map((element) =>
                  element.getAttribute('data-syllable-id'),
                ),
              ),
          ).toEqual(['s0', 's1']);
          // The placement tool persists after a commit.
          await expect(punctumTool(page)).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          expect(await pageIsContained(page)).toBe(true);

          await page.keyboard.press('Escape');
          await expect(punctumTool(page)).toHaveAttribute(
            'aria-pressed',
            'false',
          );
          await undo(page).click();
          await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
          await redo(page).click();
          await expect.poll(() => scoreOrder(page)).toEqual(placed);
        },
      );

      // PR #48: the oversized syllable's extended staff still exposes both
      // insertion slots beside its following bar.
      test(`places a punctum ${side} a division beside an oversized lyric at ${width}px`, async ({
        page,
      }) => {
        const chant = punctumScore();
        chant.syllables[0].text = 'a'.repeat(180);
        await mount(page, width, chant);
        await tools(page)
          .getByRole('button', { name: 'Punctum', exact: true })
          .click();
        await placePunctumBeside(page, side);
      });
    }
  }
});

test.describe('explicit insertion beside a selected division', () => {
  for (const width of widths) {
    for (const side of sides) {
      test(`pointer: "Insert Punctum ${side} division" at ${width}px`, async ({
        page,
      }) => {
        await mount(page, width);
        await selectDivisionByPointer(page);
        await page
          .getByRole('button', { name: `Insert Punctum ${side} division` })
          .click();
        await expect.poll(() => scoreOrder(page)).toHaveLength(4);
        expect(await indexOfD(page)).toBe(side === 'before' ? 2 : 1);
        await undo(page).click();
        await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
      });

      test(`keyboard: Tab reaches "Insert Punctum ${side} division" and Enter inserts it at ${width}px`, async ({
        page,
      }) => {
        await mount(page, width);
        await division(page).focus();
        await page.keyboard.press('Enter');
        const kind = page.getByRole('combobox', {
          name: 'Change division kind',
        });
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
        expect(await indexOfD(page)).toBe(side === 'before' ? 2 : 1);
        await undo(page).click();
        await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
      });
    }
  }
});

test.describe('selection, kind, deletion and history', () => {
  for (const width of widths) {
    test(`pointer selects a division; kind change keeps identity and focus through Undo/Redo; Delete and Undo at ${width}px`, async ({
      page,
    }) => {
      await mount(page, width);
      // Issue #121: the press focuses the division, and the Divisions panel
      // that follows focus must not move the score before the click.
      await selectDivisionByPointer(page);
      await expect(division(page)).toHaveAttribute('role', 'button');

      // selectOption is programmatic, like the legacy DOM change; neither
      // opens the native popup.
      await page
        .getByRole('combobox', { name: 'Change division kind' })
        .selectOption('finalis');
      await expect(division(page)).toHaveAttribute(
        'data-division-kind',
        'finalis',
      );
      await expect(
        division(page).locator('.score__division-ink line'),
      ).toHaveCount(2);

      await undo(page).click();
      await expect(division(page)).toHaveAttribute(
        'data-division-kind',
        'minima',
      );
      await expect(
        division(page).locator('.score__division-ink line'),
      ).toHaveCount(1);
      await expect(division(page)).toBeFocused();

      await redo(page).click();
      await expect(division(page)).toHaveAttribute(
        'data-division-kind',
        'finalis',
      );
      await expect(division(page)).toBeFocused();

      await page.keyboard.press('Delete');
      await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'n1']);
      await undo(page).click();
      // The restored division keeps its original ID and its redone kind.
      await expect.poll(() => scoreOrder(page)).toEqual(['n0', 'D', 'n1']);
      await expect(division(page)).toHaveAttribute(
        'data-division-kind',
        'finalis',
      );
    });

    test(
      `keyboard: Tab traverses note → division → note, Enter selects, Backspace deletes at ${width}px`,
      // Hosted CI smoke: the representative keyboard workflow.
      { tag: width === 1440 ? ['@smoke'] : [] },
      async ({ page }) => {
        await mount(page, width);
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
      },
    );
  }
});

test.describe('Division menu', () => {
  for (const width of widths) {
    test(`places all four kinds with their ghost ink; placement stays armed and Escape returns to Select at ${width}px`, async ({
      page,
    }) => {
      await mount(page, width);
      for (const kind of ['minima', 'minor', 'maior', 'finalis'] as const) {
        await divisionArrow(page).click();
        await divisionMenu(page)
          .getByRole('menuitemradio', { name: kindNames[kind] })
          .click();
        await expect(divisionMenu(page)).toHaveCount(0);
        await expect(divisionArrow(page)).toHaveAttribute(
          'data-active-variant',
          kind,
        );

        const point = await pointPastLastItem(page);
        await page.mouse.move(point.x + 2, point.y + 2);
        await page.mouse.move(point.x, point.y);
        await expect(
          page.locator('.score__placement-ghost .score__division-ink line'),
        ).toHaveCount(kind === 'finalis' ? 2 : 1);
        // The preview is neither focusable nor a pointer target.
        await expect(
          page.locator('.score__placement-preview [tabindex]'),
        ).toHaveCount(0);
        expect(
          await page.evaluate(
            ({ x, y }) =>
              document
                .elementFromPoint(x, y)
                ?.closest('.score__placement-preview') ?? null,
            point,
          ),
        ).toBeNull();

        const before = (await scoreOrder(page)).length;
        await page.mouse.down();
        await page.mouse.up();
        await expect
          .poll(async () => (await scoreOrder(page)).length)
          .toBe(before + 1);
        // Placement stays armed with this kind; no neume tool is armed.
        await expect(divisionArrow(page)).toHaveAttribute(
          'data-active-variant',
          kind,
        );
        await expect(punctumTool(page)).toHaveAttribute(
          'aria-pressed',
          'false',
        );
        await page.keyboard.press('Escape');
        await expect(divisionArrow(page)).not.toHaveAttribute(
          'data-active-variant',
        );
      }

      expect(await scoreOrder(page)).toHaveLength(7);
      const added = await page
        .locator('[data-division-id]:not([data-division-id="D"])')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-division-kind')),
        );
      expect(added.sort()).toEqual(['finalis', 'maior', 'minima', 'minor']);
      // Division tools do not change the remembered neume kind.
      await expect(page.locator('button.editor-insert')).toContainText(
        'Insert Punctum',
      );
      expect(await pageIsContained(page)).toBe(true);
    });
  }

  test('keyboard: End and Enter choose Finalis, Escape returns focus, and primary and menu both remember the armed kind', async ({
    page,
  }) => {
    await mount(page, 1440);
    await divisionPrimary(page).click();
    await expect(divisionPrimary(page)).toHaveAttribute('aria-pressed', 'true');

    // Fixture setup: start from the arrow without arming anything else.
    await divisionArrow(page).focus();
    await page.keyboard.press('Enter');
    const item = (kind: keyof typeof kindNames) =>
      divisionMenu(page).getByRole('menuitemradio', { name: kindNames[kind] });
    await expect(item('minima')).toBeFocused();
    await page.keyboard.press('End');
    await expect(item('finalis')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(divisionMenu(page)).toHaveCount(0);
    await expect(divisionArrow(page)).toBeFocused();
    await expect(divisionArrow(page)).toHaveAttribute(
      'data-active-variant',
      'finalis',
    );

    // Menu activation is remembered for the next opening.
    await page.keyboard.press('Enter');
    await expect(item('finalis')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(divisionMenu(page)).toHaveCount(0);
    await expect(divisionArrow(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(divisionArrow(page)).not.toHaveAttribute(
      'data-active-variant',
    );

    // Primary activation is remembered too: Minima after Finalis.
    await divisionPrimary(page).click();
    await page.keyboard.press('Escape');
    await divisionArrow(page).focus();
    await page.keyboard.press('Enter');
    await expect(item('minima')).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(page.locator('button.editor-insert')).toContainText(
      'Insert Punctum',
    );
    // With no division focused or selected there is no empty Divisions group.
    await expect(page.locator('.division-controls')).toHaveCount(0);
  });
});
