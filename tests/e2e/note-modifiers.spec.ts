import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import {
  cachedText,
  exportThroughDownload,
  openWithCache,
  recoveryAction,
  saveStatus,
} from './helpers/preview-document.ts';

// Issue #123 (M2.4): the note-modifiers driver's intermittent null read was
// its own click on "Download original cached source" missing the button. The
// click was aimed at coordinates measured in the same frame as the editor's
// documented focus reveal, which then scrolled the page. See
// docs/verification/issue-123/README.md. The full driver migration is M2.12.
// Contracts: docs/persistence.md ("withdrawn draft recovery", "One active
// browser score") and docs/editor-interactions.md ("Focus": programmatic focus
// is revealed).
test.use({ baseURL: previewOrigin });

const casesUrl = new URL(
  '../../docs/verification/note-modifiers/conventional/editor-cases.chant.json',
  import.meta.url,
);

test('an incompatible cache is neither loaded nor overwritten, and its original bytes download after closing note properties', async ({
  page,
}) => {
  // The legacy scenario: a withdrawn draft-v2 value (mora 2) makes the
  // cached file incompatible; its exact bytes, including formatting, must be
  // recoverable.
  const incompatible = JSON.parse(await readFile(casesUrl, 'utf8'));
  incompatible.document.neumes[0].notes[0].mora = 2;
  const original = '\n' + JSON.stringify(incompatible, null, 3) + '\n';
  await openWithCache(page, original);
  await expect(saveStatus(page)).toContainText('requires resolution');

  // Edit the bundled example shown instead: select a note natively and change
  // its mora scope. Nothing is written over the incompatible cache.
  const note = page.locator('[data-note-id="note-punctum-1"]');
  await note.locator('.score__note-hit-target').click();
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Mora scope' }).selectOption('sole');
  expect(await cachedText(page)).toBe(original);
  await expect(saveStatus(page)).toContainText('requires resolution');

  // Closing the panel restores focus to the note; the editor reveals it in
  // the next animation frame (the reveal that moved the legacy driver's
  // button between measurement and click).
  await page.getByRole('button', { name: 'Close note properties' }).click();
  await expect(note).toBeFocused();

  // A native click waits until the button is stable, then hits it.
  const download = page.waitForEvent('download');
  await recoveryAction(page, 'Download original cached source').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('recovered-original.chant.json');
  const path = await file.path();
  expect(await readFile(path, 'utf8')).toBe(original);

  // Export writes the current score, separately from source recovery.
  const exported = await exportThroughDownload(page);
  expect(exported.text).not.toBe(original);
  expect(await cachedText(page)).toBe(original);
});
