import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import {
  answerNextConfirm,
  cached,
  cachedText,
  current,
  documentAction,
  exportThroughDownload,
  fixture,
  importAlert,
  importThroughFileChooser,
  importThroughFileInput,
  lyricLanguage,
  openWithCache,
  recoveryAction,
  redo,
  saveStatus,
  storageKey,
  titleButton,
  undo,
} from './helpers/preview-document.ts';
import { pageIsContained } from './helpers/score.ts';

// Browser autosave, recovery and file workflows on the built application
// served by Vite preview. Contract: docs/persistence.md ("One active browser
// score", "Document controls"). Title editing: document-title.spec.ts; header
// layout: document-header.spec.ts.
test.use({ baseURL: previewOrigin });

const currentText = JSON.stringify(current);

// Native widths at which the header must not make the page scroll sideways.
async function expectContainedAt(page: Page, widths = [1440, 320]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await pageIsContained(page), `contained at ${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
}

test.describe('autosave', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
  });

  test(
    'first load saves nothing; a committed edit saves and survives refresh with fresh history, then Undo/Redo persist',
    // Hosted CI smoke: persistence across a refresh.
    { tag: '@smoke' },
    async ({ page }) => {
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
    },
  );

  // The save runs synchronously while the input event that caused the edit is
  // still being dispatched (docs/persistence.md: "synchronously saves when
  // history.present changes, before publishing the next React state"). A
  // window listener in the bubble phase runs after React's root listener, in
  // that same task, and records the cache bytes it sees.
  test('a committed edit is already saved when its input event finishes dispatching', async ({
    page,
  }) => {
    await page.evaluate((key) => {
      const seen: Record<string, string | null> = {};
      Object.assign(window, { cacheAtDispatch: seen });
      for (const type of ['change', 'click'])
        window.addEventListener(type, () => {
          seen[type] = localStorage.getItem(key);
        });
    }, storageKey);
    const atDispatch = (type: string) =>
      page.evaluate(
        (name) =>
          (
            window as unknown as {
              cacheAtDispatch: Record<string, string | null>;
            }
          ).cacheAtDispatch[name],
        type,
      );
    const language = (text: string | null | undefined) =>
      text ? JSON.parse(text).document.lyricLanguage : null;

    await lyricLanguage(page).selectOption('el');
    expect(language(await atDispatch('change'))).toBe('el');

    // Native pointer click on Undo.
    await undo(page).click();
    expect(language(await atDispatch('click'))).toBe('la');
  });

  test('Undo back to the loaded score saves those exact bytes, which survive refresh', async ({
    page,
  }) => {
    await openWithCache(page, currentText);
    await lyricLanguage(page).selectOption('en');
    await expect
      .poll(() => cached(page))
      .toMatchObject({ document: { lyricLanguage: 'en' } });
    await undo(page).click();
    await expect.poll(() => cached(page)).toEqual(current);
    await page.reload();
    await expect(lyricLanguage(page)).toHaveValue('la');
    expect(await cached(page)).toEqual(current);
  });
});

test.describe('files', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
  });

  test('import via the native file chooser, cancel a replacement, reject a malformed file, then New with cancel/accept', async ({
    page,
  }) => {
    await lyricLanguage(page).selectOption('el');
    await expect.poll(() => cachedText(page)).not.toBeNull();

    await answerNextConfirm(page, true, () =>
      importThroughFileChooser(page, JSON.stringify(fixture)),
    );
    await expect.poll(() => cached(page)).toEqual(current);
    await expect(undo(page)).toBeDisabled();
    expect(await page.locator('[data-system-index]').count()).toBeGreaterThan(
      1,
    );
    await expect(
      page.getByRole('button', { name: 'Edit chant title: Salve / Regina' }),
    ).toBeVisible();

    // Cancelling the replacement prompt keeps the cached score.
    const afterImport = await cachedText(page);
    await answerNextConfirm(page, false, () =>
      importThroughFileInput(
        page,
        JSON.stringify({
          ...fixture,
          document: { ...fixture.document, title: 'Canceled' },
        }),
      ),
    );
    expect(await cachedText(page)).toBe(afterImport);

    // A malformed file is rejected, announced, and leaves the cache intact.
    await importThroughFileInput(page, '{broken');
    await expect(importAlert(page)).toContainText('Import failed');
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

  // One browser path per rejection class; exhaustive validation is in
  // src/editor/persistence/*.test.ts. The oversized file is rejected by size
  // before it is read, which only the browser file path exercises.
  test('rejected imports keep the cache, the score and the undo history, and each is announced', async ({
    page,
  }) => {
    await openWithCache(page, currentText);
    await lyricLanguage(page).selectOption('en');
    await expect
      .poll(() => cached(page))
      .toMatchObject({ document: { lyricLanguage: 'en' } });
    const committed = await cachedText(page);
    await expect(undo(page)).toBeEnabled();

    const rejected: [string, string | Buffer][] = [
      ['malformed JSON', '{broken'],
      ['future version', JSON.stringify({ ...fixture, version: 11 })],
      [
        'invalid document',
        JSON.stringify({
          ...fixture,
          document: { ...fixture.document, neumes: null },
        }),
      ],
      ['larger than 1 MiB', Buffer.alloc(1024 * 1024 + 1, ' ')],
      [
        'unsafe integer pitch',
        JSON.stringify({
          ...fixture,
          document: {
            ...fixture.document,
            neumes: [
              {
                id: 'unsafe',
                kind: 'punctum',
                notes: [
                  {
                    id: 'unsafe-note',
                    staffPosition: Number.MAX_SAFE_INTEGER + 1,
                  },
                ],
              },
            ],
          },
        }),
      ],
    ];
    const messages: string[] = [];
    for (const [name, contents] of rejected) {
      const previous = messages.at(-1) ?? '';
      await importThroughFileInput(page, contents);
      await expect(importAlert(page), name).toContainText('Import failed');
      // Each attempt produces its own announcement, not a stale one.
      await expect(importAlert(page), name).not.toHaveText(previous);
      messages.push((await importAlert(page).textContent()) ?? '');
      expect(await cachedText(page), name).toBe(committed);
      await expect(lyricLanguage(page), name).toHaveValue('en');
      await expect(undo(page), name).toBeEnabled();
    }
    await undo(page).click();
    await expect.poll(() => cached(page)).toEqual(current);
  });
});

test.describe('recovery', () => {
  test('a write from another tab is detected and neither score is overwritten until the cache is loaded', async ({
    page,
    context,
  }) => {
    await page.goto('/');
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
    await expectContainedAt(page);
    await lyricLanguage(page).selectOption('und');
    expect(await cachedText(page)).toBe(otherText);

    await answerNextConfirm(page, true, () =>
      recoveryAction(page, 'Load cached score').click(),
    );
    await expect(
      page.getByRole('button', { name: 'Edit chant title: Other tab' }),
    ).toBeVisible();
    expect(await cachedText(page)).toBe(otherText);
  });

  test('a corrupt cache survives load and edits until it is explicitly replaced', async ({
    page,
  }) => {
    await openWithCache(page, '{damaged');
    await expect(saveStatus(page)).toContainText('invalid or unavailable');
    await expectContainedAt(page);
    // The bundled example stays usable; edits do not write.
    await lyricLanguage(page).selectOption('el');
    await expect(lyricLanguage(page)).toHaveValue('el');
    expect(await cachedText(page)).toBe('{damaged');
    await page.reload();
    expect(await cachedText(page)).toBe('{damaged');

    await lyricLanguage(page).selectOption('el');
    const replace = recoveryAction(
      page,
      'Replace cache with this score / Retry save',
    );
    await answerNextConfirm(page, false, () => replace.click());
    expect(await cachedText(page)).toBe('{damaged');
    await answerNextConfirm(page, true, () => replace.click());
    await expect
      .poll(() => cached(page))
      .toMatchObject({ document: { lyricLanguage: 'el' } });
    await expect(saveStatus(page)).toContainText('Saved locally');
  });

  test('throwing storage keeps the edit in memory, reports Not saved, and Retry saves it', async ({
    page,
  }) => {
    await openWithCache(page, currentText);
    const committed = await cachedText(page);
    // Controlled fault: every localStorage write throws, as on a full quota.
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Object.assign(window, { originalSetItem: original });
      Storage.prototype.setItem = () => {
        throw new DOMException('quota test', 'QuotaExceededError');
      };
    });
    await lyricLanguage(page).selectOption('en');
    await expect(saveStatus(page)).toContainText('Not saved');
    await expect(lyricLanguage(page)).toHaveValue('en');
    expect(await cachedText(page)).toBe(committed);

    await page.evaluate(() => {
      Storage.prototype.setItem = (
        window as unknown as { originalSetItem: Storage['setItem'] }
      ).originalSetItem;
    });
    await answerNextConfirm(page, true, () =>
      recoveryAction(
        page,
        'Replace cache with this score / Retry save',
      ).click(),
    );
    await expect
      .poll(() => cached(page))
      .toMatchObject({ document: { lyricLanguage: 'en' } });
    await expect(saveStatus(page)).toContainText('Saved locally');
  });
});

test.describe('pending edits block Document controls', () => {
  const blockedControls = (page: Page) => [
    documentAction(page, 'New'),
    documentAction(page, 'Import'),
    documentAction(page, 'Export'),
    page.getByRole('combobox', { name: 'Load example' }),
    titleButton(page),
  ];

  test.beforeEach(async ({ page }) => {
    await openWithCache(page, currentText);
  });

  test('a dirty lyric draft disables every Document control without saving', async ({
    page,
  }) => {
    const committed = await cachedText(page);
    const lyric = page.locator('.score__lyric[data-syllable-id="s1"]');
    await lyric.scrollIntoViewIfNeeded();
    await lyric.dblclick();
    const input = page.locator('#lyric-input');
    await expect(input).toBeFocused();
    await input.fill('Draft');

    for (const control of blockedControls(page))
      await expect(control).toBeDisabled();
    await expect(saveStatus(page)).toContainText('Pending edits');
    expect(await cachedText(page)).toBe(committed);
  });

  test('a staged clef edit disables every Document control until it is cancelled, without saving', async ({
    page,
  }) => {
    const committed = await cachedText(page);
    const clef = page.locator('[data-clef-change-id="c1"]');
    await clef.scrollIntoViewIfNeeded();
    await clef.click();
    await page.getByRole('button', { name: 'Edit clef change' }).click();

    for (const control of blockedControls(page))
      await expect(control).toBeDisabled();
    expect(await cachedText(page)).toBe(committed);

    await page.getByRole('button', { name: 'Cancel clef change' }).click();
    for (const control of blockedControls(page))
      await expect(control).toBeEnabled();
    expect(await cachedText(page)).toBe(committed);
  });
});
