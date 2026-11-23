import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';

// Helpers for the production-preview application's Document header and its
// single localStorage cache. Every Playwright test has a fresh browser
// context, so storage starts empty and is never shared.

export const storageKey = 'gregorian-chant-editor:active-document:v1';

// Multi-system score with lyrics, manual alignment, divisions and C/F clef
// changes, written in an older native version (8). Import re-saves and
// export writes the current native version (10).
export const fixture = {
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
export const current = { ...fixture, version: 10 };

// Reading the cache is how these tests observe the persistence contract;
// the page offers no user-facing view of the stored bytes.
export const cachedText = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), storageKey);
export async function cached(page: Page): Promise<unknown> {
  const text = await cachedText(page);
  return text === null ? null : JSON.parse(text);
}
export const cachedTitle = async (page: Page) =>
  ((await cached(page)) as { document: { title: string } } | null)?.document
    .title;

// Controlled setup: store bytes in the cache, as an earlier session or
// another tab would, then load the application so it restores them.
export async function openWithCache(page: Page, text: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    storageKey,
    text,
  ] as const);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
}

export const saveStatus = (page: Page) =>
  page.getByRole('region', { name: 'Document' }).getByRole('status').first();
export const importAlert = (page: Page) =>
  page.getByRole('region', { name: 'Document' }).getByRole('alert');
export const lyricLanguage = (page: Page) =>
  page.getByRole('combobox', { name: 'Lyric language' });
export const undo = (page: Page) =>
  page.getByRole('button', { name: 'Undo last edit' });
export const redo = (page: Page) =>
  page.getByRole('button', { name: 'Redo last undone edit' });
export const documentAction = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Document actions' })
    .getByRole('button', { name, exact: true });
export const recoveryAction = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Document recovery' })
    .getByRole('button', { name });
export const titleButton = (page: Page) =>
  page.getByRole('button', { name: /^Edit chant title:/ });
export const titleInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Chant title' });

// Native window.confirm is answered through Playwright's dialog API. Each
// call answers exactly the next dialog and asserts that one appeared.
export async function answerNextConfirm(
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

export async function importThroughFileChooser(
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
// reports a second or later Import picker in the same page, more often under
// parallel load (page.bringToFront() did not help); no first picker in a page
// failed locally. Each test therefore opens at most one native picker and uses
// this for any later import. See docs/verification/playwright-m1/README.md.
export async function importThroughFileInput(
  page: Page,
  contents: string | Buffer,
): Promise<void> {
  await page.getByLabel('Import native chant JSON').setInputFiles({
    name: 'score.chant.json',
    mimeType: 'application/json',
    buffer: typeof contents === 'string' ? Buffer.from(contents) : contents,
  });
}

export async function exportThroughDownload(
  page: Page,
): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent('download');
  await documentAction(page, 'Export').click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}
