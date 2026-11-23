import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import {
  answerNextConfirm,
  cached,
  cachedText,
  cachedTitle,
  current,
  documentAction,
  exportThroughDownload,
  importThroughFileInput,
  openWithCache,
  redo,
  saveStatus,
  titleButton,
  titleInput,
  undo,
} from './helpers/preview-document.ts';
import { pageIsContained } from './helpers/score.ts';

// Title editing in the Document header on the production preview. Contract:
// docs/persistence.md, "Document controls"; docs/editor-interactions.md,
// "Document controls (Stage 7A)".
test.use({ baseURL: previewOrigin });

const named = 'Sálve / Regina';
const currentText = JSON.stringify(current);

async function startTitle(page: Page) {
  await titleButton(page).click();
  await expect(titleInput(page)).toBeFocused();
}

async function commitTitle(page: Page, title: string) {
  await startTitle(page);
  await titleInput(page).fill(title);
  await page.keyboard.press('Enter');
  await expect.poll(() => cachedTitle(page)).toBe(title);
}

test('title edits stay a draft until Enter, Escape cancels, and the committed title survives refresh and Undo', async ({
  page,
}) => {
  await page.goto('/');
  const originalTitle = (await titleButton(page).textContent())?.replace(
    '✎',
    '',
  );
  expect(originalTitle).toBeTruthy();

  await startTitle(page);
  await titleInput(page).fill('Draft title');
  // Nothing is cached yet, so the draft hint follows the "not saved" status.
  await expect(saveStatus(page)).toContainText(
    'Enter or leave the title to save',
  );
  expect(await cachedText(page)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(titleButton(page)).toBeFocused();
  await expect(titleButton(page)).toHaveText(`${originalTitle}✎`);
  expect(await cachedText(page)).toBeNull();
  await expect(undo(page)).toBeDisabled();

  await startTitle(page);
  await titleInput(page).fill('');
  await titleInput(page).pressSequentially(named);
  await page.keyboard.press('Enter');
  await expect(titleButton(page)).toBeFocused();
  await expect(titleButton(page)).toHaveText(`${named}✎`);
  await expect.poll(() => cachedTitle(page)).toBe(named);

  await page.reload();
  await expect(titleButton(page)).toHaveText(`${named}✎`);
  await expect(page.locator('h1')).toHaveCount(1);
  // Refresh starts a fresh history; a new title session is one entry.
  await expect(undo(page)).toBeDisabled();
  await startTitle(page);
  await titleInput(page).fill('Second title');
  await page.keyboard.press('Enter');
  await expect.poll(() => cachedTitle(page)).toBe('Second title');
  await undo(page).click();
  await expect.poll(() => cachedTitle(page)).toBe(named);
  await expect(undo(page)).toBeDisabled();
});

test.describe('with a cached score', () => {
  test.beforeEach(async ({ page }) => {
    await openWithCache(page, currentText);
  });

  test('a typed draft is not saved, says so, keeps the page contained, and Escape restores the title', async ({
    page,
  }) => {
    await startTitle(page);
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(titleInput(page)).toHaveValue('Salve / Regina!');
    await expect(saveStatus(page)).toContainText('Title not saved');
    expect(await cachedText(page)).toBe(currentText);
    await expect(undo(page)).toBeDisabled();
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await pageIsContained(page), `${width}px`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(titleButton(page)).toBeFocused();
    await expect(titleButton(page)).toHaveText('Salve / Regina✎');
    expect(await cachedText(page)).toBe(currentText);
  });

  test('several edits in one title session are one history entry', async ({
    page,
  }) => {
    await startTitle(page);
    await titleInput(page).fill('Sál');
    await titleInput(page).pressSequentially('ve / Regina');
    await titleInput(page).fill(named);
    await page.keyboard.press('Enter');
    await expect.poll(() => cachedTitle(page)).toBe(named);
    await undo(page).click();
    await expect.poll(() => cachedTitle(page)).toBe('Salve / Regina');
    await expect(undo(page)).toBeDisabled();
  });

  test('Escape on a later draft and Enter on unchanged text both keep the redo branch', async ({
    page,
  }) => {
    await commitTitle(page, named);
    await undo(page).click();
    await expect.poll(() => cachedTitle(page)).toBe('Salve / Regina');

    await startTitle(page);
    await titleInput(page).fill('Canceled title');
    await page.keyboard.press('Escape');
    await expect(redo(page)).toBeEnabled();

    // Leaving unchanged text adds no history entry.
    await startTitle(page);
    await page.keyboard.press('Enter');
    await expect(redo(page)).toBeEnabled();
    await expect(undo(page)).toBeDisabled();

    await redo(page).click();
    await expect.poll(() => cachedTitle(page)).toBe(named);
  });

  test('leaving the title by native Tab commits it and focus follows the user', async ({
    page,
  }) => {
    await startTitle(page);
    await titleInput(page).fill('Blur title');
    await page.keyboard.press('Tab');
    await expect.poll(() => cachedTitle(page)).toBe('Blur title');
    // Blur keeps the user's next focus target rather than the heading button.
    await expect(titleInput(page)).toHaveCount(0);
    await expect(titleButton(page)).not.toBeFocused();
    await undo(page).click();
    await expect.poll(() => cachedTitle(page)).toBe('Salve / Regina');
  });

  test('Export commits a pending title before writing the file', async ({
    page,
  }) => {
    await startTitle(page);
    await titleInput(page).fill(`${named}!`);
    const exported = await exportThroughDownload(page);
    expect(JSON.parse(exported.text).document.title).toBe(`${named}!`);
    expect(exported.name).toBe('Sálve-Regina.chant.json');
    await expect.poll(() => cachedTitle(page)).toBe(`${named}!`);
  });

  test('filenames come from the committed title, an empty title exports as untitled, and a re-import restores the title', async ({
    page,
  }) => {
    await commitTitle(page, named);
    const namedExport = await exportThroughDownload(page);
    expect(namedExport.name).toBe('Sálve-Regina.chant.json');
    expect(JSON.parse(namedExport.text).document.title).toBe(named);

    await commitTitle(page, '');
    await expect(titleButton(page)).toHaveText('Untitled chant✎');
    await expect(
      page.getByRole('button', { name: 'Edit chant title: Untitled chant' }),
    ).toBeVisible();
    expect((await exportThroughDownload(page)).name).toBe(
      'untitled.chant.json',
    );

    await answerNextConfirm(page, true, () =>
      importThroughFileInput(page, namedExport.text),
    );
    await expect(titleButton(page)).toHaveText(`${named}✎`);
    await expect
      .poll(() => cached(page))
      .toMatchObject({ document: { title: named } });
    await expect(documentAction(page, 'Export')).toBeEnabled();
  });

  // Genuine composition through Chromium's own input-method pipeline: CDP
  // Input.imeSetComposition starts a composition in the focused input (with
  // compositionstart/update and isComposing key events), as an OS IME would
  // through the browser. It does not exercise an OS IME, candidate window or
  // Firefox; Playwright offers no composition API for Firefox.
  test('Chromium IME: Enter while composing does not commit; Enter after composition does', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'CDP input-method composition is Chromium-only; see the synthetic guard test.',
    );
    await startTitle(page);
    await page.keyboard.press('End');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', {
      text: 'é',
      selectionStart: 1,
      selectionEnd: 1,
    });
    await expect(titleInput(page)).toHaveValue('Salve / Reginaé');
    // Record what the input sees for the Enter pressed during composition.
    await titleInput(page).evaluate((element: HTMLInputElement) => {
      element.addEventListener(
        'keydown',
        (event) => {
          Object.assign(window, { enterWhileComposing: event.isComposing });
        },
        { once: true },
      );
    });
    await page.keyboard.press('Enter');
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { enterWhileComposing: boolean })
            .enterWhileComposing,
      ),
    ).toBe(true);
    await expect(titleInput(page)).toBeFocused();
    expect(await cachedText(page)).toBe(currentText);

    await cdp.send('Input.insertText', { text: 'é' });
    await expect(titleInput(page)).toHaveValue('Salve / Reginaé');
    await page.keyboard.press('Enter');
    await expect.poll(() => cachedTitle(page)).toBe('Salve / Reginaé');
    await expect(titleButton(page)).toBeFocused();
  });

  // Handler guard only, in both browsers: a dispatched keydown marked
  // isComposing must not commit. This does not establish real IME behaviour.
  test('a keydown marked isComposing does not commit the title (synthetic guard check)', async ({
    page,
  }) => {
    await startTitle(page);
    await titleInput(page).fill(named);
    await titleInput(page).dispatchEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
    });
    await expect(titleInput(page)).toBeVisible();
    expect(await cachedText(page)).toBe(currentText);
    await page.keyboard.press('Enter');
    await expect.poll(() => cachedTitle(page)).toBe(named);
  });
});
