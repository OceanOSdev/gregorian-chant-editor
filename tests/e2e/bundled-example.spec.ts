import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import {
  answerNextConfirm,
  cached,
  cachedText,
  exportThroughDownload,
  openWithCache,
  recoveryAction,
  saveStatus,
  storageKey,
  undo,
  redo,
} from './helpers/preview-document.ts';
import { pageIsContained } from './helpers/score.ts';

// Load example on the production preview. Contract: docs/persistence.md,
// "Bundled examples"; docs/editor-interactions.md, "Sticky editing tools".
test.use({ baseURL: previewOrigin });

interface Chant {
  title: string;
  neumes: { notes: unknown[] }[];
}

const loadExample = (page: Page) =>
  page.getByRole('combobox', { name: 'Load example' });
const cachedDocument = async (page: Page) =>
  ((await cached(page)) as { document: Chant } | null)?.document;

async function expectContainedAt(page: Page) {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await pageIsContained(page), `contained at ${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
}

// Choose an example by its visible name and answer the native confirmation;
// returns the confirmation text.
async function chooseExample(page: Page, name: string, accept: boolean) {
  const dialog = page.waitForEvent('dialog');
  const chosen = loadExample(page).selectOption({ label: name });
  const shown = await dialog;
  const message = shown.message();
  expect(shown.type()).toBe('confirm');
  await (accept ? shown.accept() : shown.dismiss());
  await chosen;
  return message;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
});

test('keyboard choice asks to confirm the named example and keeps focus on the selector', async ({
  page,
}) => {
  expect(await cachedText(page)).toBeNull();
  await expectContainedAt(page);
  const firstName = await loadExample(page)
    .locator('option')
    .nth(1)
    .textContent();
  expect(firstName).toBeTruthy();

  await loadExample(page).focus();
  // The confirmation opens during the keydown, so answer it from a handler
  // registered before the key is pressed.
  const messages: string[] = [];
  page.once('dialog', async (dialog) => {
    messages.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => messages).toHaveLength(1);
  expect(messages[0]).toMatch(/^confirm: /);
  expect(messages[0]).toContain(firstName ?? '');
  await expect(loadExample(page)).toBeFocused();
  await expect(loadExample(page)).toHaveValue('');
  expect(await cachedText(page)).toBeNull();
});

test('Pater Noster: cancel keeps everything; accept replaces the score with fresh history, saves, survives refresh and exports', async ({
  page,
}) => {
  const message = await chooseExample(page, 'Pater Noster', false);
  expect(message).toMatch(/Pater Noster/);
  expect(message).toMatch(/undo\/redo history/);
  expect(message).toMatch(/Export/);
  expect(await cachedText(page)).toBeNull();
  // The selector resets so the same example can be chosen again.
  await expect(loadExample(page)).toHaveValue('');

  await chooseExample(page, 'Pater Noster', true);
  await expect.poll(() => cachedDocument(page)).toBeTruthy();
  const document = await cachedDocument(page);
  expect(document?.title).toBe('Pater Noster');
  expect(document?.neumes).toHaveLength(103);
  expect(document?.neumes.flatMap((n) => n.notes)).toHaveLength(111);
  await expect(undo(page)).toBeDisabled();
  await expect(loadExample(page)).toHaveValue('');

  const saved = await cachedText(page);
  await page.reload();
  expect(await cachedText(page)).toBe(saved);
  const exported = await exportThroughDownload(page);
  expect(JSON.parse(exported.text).document).toEqual(document);
  await expectContainedAt(page);
});

test('a load during a cache conflict stays in memory until the cache is explicitly replaced', async ({
  page,
  context,
}) => {
  await chooseExample(page, 'Pater Noster', true);
  await expect.poll(() => cachedDocument(page)).toBeTruthy();
  const pater = await cachedDocument(page);

  // A real second tab writes foreign bytes into the same cache.
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(
    ([key]) => localStorage.setItem(key, 'foreign protected bytes'),
    [storageKey] as const,
  );
  await other.close();
  await expect(saveStatus(page)).toContainText('another tab');

  await chooseExample(page, 'Pater Noster', true);
  expect(await cachedText(page)).toBe('foreign protected bytes');
  await expect(saveStatus(page)).toContainText('Not saved');

  await answerNextConfirm(page, true, () =>
    recoveryAction(page, 'Replace cache with this score / Retry save').click(),
  );
  await expect.poll(() => cachedDocument(page)).toEqual(pater);
});

test('an incompatible cache is not overwritten by a load until it is explicitly replaced', async ({
  page,
}) => {
  await chooseExample(page, 'Pater Noster', true);
  await expect.poll(() => cachedDocument(page)).toBeTruthy();
  const saved = JSON.parse((await cachedText(page)) ?? '');
  const pater = saved.document;
  // A withdrawn draft-v2 value makes the cached file incompatible.
  const incompatible = structuredClone(saved);
  incompatible.version = 2;
  incompatible.document.neumes[0].notes[0].mora = 2;
  const protectedText = JSON.stringify(incompatible);
  await openWithCache(page, protectedText);

  await chooseExample(page, 'Pater Noster', true);
  expect(await cachedText(page)).toBe(protectedText);
  await expect(saveStatus(page)).toContainText('Not saved');
  await answerNextConfirm(page, true, () =>
    recoveryAction(page, 'Replace cache with this score / Retry save').click(),
  );
  await expect.poll(() => cachedDocument(page)).toEqual(pater);
});

test.describe('long bundled score (Kyrie XI)', () => {
  for (const width of [1440, 320]) {
    test(`sticky tools stay pinned and arm in place, and a lower-staff click places there with Undo/Redo, at ${width}px`, async ({
      page,
    }) => {
      const kyrie = await loadExample(page)
        .locator('option', { hasText: /Kyrie XI/i })
        .textContent();
      expect(kyrie).toBeTruthy();
      await chooseExample(page, kyrie ?? '', true);
      await page.setViewportSize({ width, height: 1100 });
      // Fixture setup: scroll to the middle of the score.
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight / 2),
      );
      const tools = page.locator('.editor-sticky-toolbar');
      await expect
        .poll(() =>
          tools.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const header = document
              .querySelector('.document-header')
              ?.getBoundingClientRect();
            return (
              Math.abs(box.top) < 2 &&
              box.bottom < window.innerHeight &&
              (header?.bottom ?? 0) < 0
            );
          }),
        )
        .toBe(true);

      // Arming a tool in the pinned toolbar does not scroll the page.
      const scrollY = await page.evaluate(() => window.scrollY);
      const palette = page.getByRole('toolbar', { name: 'Notation tools' });
      await palette.locator('button[data-tool="minima"]').click();
      await expect(
        palette.locator('button[data-tool="minima"]'),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

      // Place a punctum on a staff line visible below the pinned tools.
      await palette
        .getByRole('button', { name: 'Punctum', exact: true })
        .click();
      const count = () => page.locator('[data-neume-id]').count();
      const before = await count();
      const point = await page.evaluate(() => {
        const top =
          document
            .querySelector('.editor-sticky-toolbar')
            ?.getBoundingClientRect().bottom ?? 0;
        const line = [...document.querySelectorAll('.score__staff-line')].find(
          (element) => {
            const box = element.getBoundingClientRect();
            return box.top > top + 30 && box.top < window.innerHeight - 50;
          },
        );
        if (!line) throw Error('No lower staff visible');
        const box = line.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top };
      });
      await page.mouse.click(point.x, point.y);
      await expect.poll(count).toBe(before + 1);
      expect(
        await page.evaluate(() => window.scrollY),
        'placement stays in the lower score',
      ).toBeGreaterThan(0);
      await undo(page).click();
      await expect.poll(count).toBe(before);
      await redo(page).click();
      await expect.poll(count).toBe(before + 1);
    });
  }

  test('a short window returns the sticky tools to normal flow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await expect
      .poll(() =>
        page
          .locator('.editor-sticky-toolbar')
          .evaluate((element) => getComputedStyle(element).position),
      )
      .toBe('static');
  });
});
