import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';

// Pilot subset of docs/verification/local-persistence/browser-check.mjs on
// the built application served by Vite preview. Every test gets a fresh
// browser context, so localStorage starts empty and is never shared.
test.use({ baseURL: previewOrigin });

const storageKey = 'gregorian-chant-editor:active-document:v1';

// Multi-system score with lyrics, manual alignment, divisions and C/F clef
// changes, written in an older native version (8). Import re-saves and
// export writes the current native version (10).
const fixture = {
  format: 'gregorian-chant-editor',
  version: 8,
  document: {
    accidentals: [],
    title: 'Salve / Regina',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 40 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: i % 5 }],
    })),
    syllables: [
      {
        id: 's1',
        text: 'Sál',
        startsAtNeumeId: 'n0',
        boundaryBefore: 'word',
        alignment: { start: 1, end: 2 },
      },
      {
        id: 's2',
        text: 've',
        startsAtNeumeId: 'n12',
        boundaryBefore: 'continuation',
      },
    ],
    divisions: [
      { id: 'd1', kind: 'minima', beforeNeumeId: 'n8' },
      { id: 'd2', kind: 'finalis', beforeNeumeId: null },
    ],
    clefChanges: [
      {
        id: 'c1',
        clef: { type: 'f', staffLine: 2 },
        beforeNeumeId: 'n15',
        beforeDivisionId: null,
      },
      {
        id: 'c2',
        clef: { type: 'c', staffLine: 4 },
        beforeNeumeId: null,
        beforeDivisionId: 'd2',
      },
    ],
  },
};
const current = { ...fixture, version: 10 };

// Reading the cache is how these tests observe the persistence contract;
// the page offers no user-facing view of the stored bytes.
const cachedText = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), storageKey);
async function cached(page: Page): Promise<unknown> {
  const text = await cachedText(page);
  return text === null ? null : JSON.parse(text);
}
const cachedTitle = async (page: Page) =>
  ((await cached(page)) as { document: { title: string } } | null)?.document
    .title;

const saveStatus = (page: Page) =>
  page.getByRole('region', { name: 'Document' }).getByRole('status').first();
const lyricLanguage = (page: Page) =>
  page.getByRole('combobox', { name: 'Lyric language' });
const undo = (page: Page) =>
  page.getByRole('button', { name: 'Undo last edit' });
const redo = (page: Page) =>
  page.getByRole('button', { name: 'Redo last undone edit' });
const documentAction = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Document actions' })
    .getByRole('button', { name, exact: true });

// Native window.confirm is answered through Playwright's dialog API. Each
// call answers exactly the next dialog and asserts that one appeared.
async function answerNextConfirm(
  page: Page,
  accept: boolean,
  action: () => Promise<void>,
): Promise<void> {
  const dialog = page.waitForEvent('dialog');
  const acted = action();
  const shown = await dialog;
  expect(shown.type()).toBe('confirm');
  await (accept ? shown.accept() : shown.dismiss());
  await acted;
}

async function importThroughFileChooser(
  page: Page,
  contents: string,
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await documentAction(page, 'Import').click();
  await (
    await chooser
  ).setFiles({
    name: 'score.chant.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
}

// Sets the bytes on the real (hidden) file input, which fires its change
// event, without a picker. Playwright Firefox 1.65.1 intermittently never
// reports a third or later Import picker in the same page (after an accepted
// import or a download; page.bringToFront() did not help), while each page's
// first two pickers never failed locally. Tests therefore open at most two
// native pickers per page and use this for later imports. See docs/testing.md.
async function importThroughFileInput(
  page: Page,
  contents: string,
): Promise<void> {
  await page.getByLabel('Import native chant JSON').setInputFiles({
    name: 'score.chant.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
}

async function exportThroughDownload(
  page: Page,
): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent('download');
  await documentAction(page, 'Export').click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
});

test('first load saves nothing; a committed edit saves and survives refresh with fresh history, then Undo/Redo persist', async ({
  page,
}) => {
  await expect(page.locator('[data-note-id]')).toHaveCount(4);
  expect(await cachedText(page)).toBeNull();

  await lyricLanguage(page).selectOption('el');
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { lyricLanguage: 'el' } });

  await page.reload();
  await expect(lyricLanguage(page)).toHaveValue('el');
  await expect(saveStatus(page)).toContainText('Saved locally');
  await expect(undo(page)).toBeDisabled();

  await lyricLanguage(page).selectOption('en');
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { lyricLanguage: 'en' } });
  await undo(page).click();
  await expect(lyricLanguage(page)).toHaveValue('el');
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { lyricLanguage: 'el' } });
  await redo(page).click();
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { lyricLanguage: 'en' } });

  await page.reload();
  await expect(lyricLanguage(page)).toHaveValue('en');
});

test('import via the native file chooser with cancel and accept, reject a malformed file, then New with cancel/accept', async ({
  page,
}) => {
  await lyricLanguage(page).selectOption('el');
  const beforeImport = await cachedText(page);

  // Cancelling the replacement prompt keeps the cached score.
  await answerNextConfirm(page, false, () =>
    importThroughFileChooser(page, JSON.stringify(fixture)),
  );
  expect(await cachedText(page)).toBe(beforeImport);

  await answerNextConfirm(page, true, () =>
    importThroughFileChooser(page, JSON.stringify(fixture)),
  );
  await expect.poll(() => cached(page)).toEqual(current);
  await expect(undo(page)).toBeDisabled();
  expect(await page.locator('[data-system-index]').count()).toBeGreaterThan(1);
  await expect(
    page.getByRole('button', { name: 'Edit chant title: Salve / Regina' }),
  ).toBeVisible();

  // A malformed file is rejected, announced, and leaves the cache intact.
  const afterImport = await cachedText(page);
  await importThroughFileInput(page, '{broken');
  await expect(
    page.getByRole('region', { name: 'Document' }).getByRole('alert'),
  ).toContainText('Import failed');
  expect(await cachedText(page)).toBe(afterImport);

  await answerNextConfirm(page, false, () =>
    documentAction(page, 'New').click(),
  );
  expect(await cachedText(page)).toBe(afterImport);
  await answerNextConfirm(page, true, () =>
    documentAction(page, 'New').click(),
  );
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { neumes: [] } });
  await expect(page.locator('[data-note-id]')).toHaveCount(0);
});

test('export through a real download writes the current version and sanitized name, and its bytes round-trip', async ({
  page,
}) => {
  await answerNextConfirm(page, true, () =>
    importThroughFileChooser(page, JSON.stringify(fixture)),
  );
  await expect.poll(() => cached(page)).toEqual(current);

  const exported = await exportThroughDownload(page);
  expect(exported.name).toBe('Salve-Regina.chant.json');
  expect(JSON.parse(exported.text)).toEqual(current);

  await answerNextConfirm(page, true, () =>
    documentAction(page, 'New').click(),
  );
  await expect(page.locator('[data-note-id]')).toHaveCount(0);
  await answerNextConfirm(page, true, () =>
    importThroughFileInput(page, exported.text),
  );
  await expect.poll(() => cached(page)).toEqual(current);
  await expect(page.locator('[data-note-id]')).toHaveCount(40);
});

test('title edits stay a draft until Enter, Escape cancels, and the committed title survives refresh and Undo', async ({
  page,
}) => {
  const titleButton = page.getByRole('button', { name: /^Edit chant title:/ });
  const titleInput = page.getByRole('textbox', { name: 'Chant title' });
  const originalTitle = (await titleButton.textContent())?.replace('✎', '');
  expect(originalTitle).toBeTruthy();

  await titleButton.click();
  await expect(titleInput).toBeFocused();
  await titleInput.fill('Draft title');
  // Nothing is cached yet, so the draft hint follows the "not saved" status.
  await expect(saveStatus(page)).toContainText(
    'Enter or leave the title to save',
  );
  expect(await cachedText(page)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(titleButton).toBeFocused();
  await expect(titleButton).toHaveText(`${originalTitle}✎`);
  expect(await cachedText(page)).toBeNull();
  await expect(undo(page)).toBeDisabled();

  const named = 'Sálve / Regina';
  await titleButton.click();
  await titleInput.fill('');
  await titleInput.pressSequentially(named);
  await page.keyboard.press('Enter');
  await expect(titleButton).toBeFocused();
  await expect(titleButton).toHaveText(`${named}✎`);
  await expect.poll(() => cachedTitle(page)).toBe(named);

  await page.reload();
  await expect(titleButton).toHaveText(`${named}✎`);
  await expect(page.locator('h1')).toHaveCount(1);
  // Refresh starts a fresh history; a new title session is one entry.
  await expect(undo(page)).toBeDisabled();
  await titleButton.click();
  await titleInput.fill('Second title');
  await page.keyboard.press('Enter');
  await expect.poll(() => cachedTitle(page)).toBe('Second title');
  await undo(page).click();
  await expect.poll(() => cachedTitle(page)).toBe(named);
  await expect(undo(page)).toBeDisabled();
});

test('a write from another tab is detected and neither score is overwritten until the cache is loaded', async ({
  page,
  context,
}) => {
  await lyricLanguage(page).selectOption('el');
  await expect
    .poll(() => cached(page))
    .toMatchObject({ document: { lyricLanguage: 'el' } });

  // A second, real tab in the same browser context (same origin storage).
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('region', { name: 'Document' })).toBeVisible();
  const otherText = JSON.stringify({
    ...current,
    document: { ...current.document, title: 'Other tab' },
  });
  // Controlled setup: write the other tab's committed score directly.
  await other.evaluate(([key, text]) => localStorage.setItem(key, text), [
    storageKey,
    otherText,
  ] as const);
  await other.close();

  await expect(saveStatus(page)).toContainText('another tab');
  await lyricLanguage(page).selectOption('und');
  expect(await cachedText(page)).toBe(otherText);

  await answerNextConfirm(page, true, () =>
    page
      .getByRole('group', { name: 'Document recovery' })
      .getByRole('button', { name: 'Load cached score' })
      .click(),
  );
  await expect(
    page.getByRole('button', { name: 'Edit chant title: Other tab' }),
  ).toBeVisible();
  expect(await cachedText(page)).toBe(otherText);
});
