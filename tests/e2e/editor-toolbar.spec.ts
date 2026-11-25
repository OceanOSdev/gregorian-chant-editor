import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import {
  answerNextConfirm,
  documentAction,
  importThroughFileInput,
  openWithCache,
  recoveryAction,
  redo,
  storageKey,
  undo,
} from './helpers/preview-document.ts';

// Notation palette roving focus, remembered presentation state and its reset,
// T focus, the action bar and the sticky threshold, on the production preview.
// Contract: docs/editor-interactions.md, "Palette and contextual keyboard
// insertion" (incl. "Palette and action-bar ownership") and "Sticky editing
// tools".
test.use({ baseURL: previewOrigin });

const palette = (page: Page) =>
  page.getByRole('toolbar', { name: 'Notation tools' });
const tool = (page: Page, name: string) =>
  palette(page).locator(`button[data-tool="${name}"]`);
const focusedTool = (page: Page) =>
  page.evaluate(
    () =>
      (document.activeElement as HTMLElement | null)?.dataset.tool ??
      (document.activeElement as HTMLElement | null)?.dataset.variant ??
      document.activeElement?.tagName,
  );
const rovingStops = (page: Page) =>
  palette(page)
    .locator('button[tabindex="0"]')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('data-tool')));
const divisionArrow = (page: Page) => tool(page, 'division-menu');

const importFixture = {
  format: 'gregorian-chant-editor',
  version: 10,
  document: {
    accidentals: [],
    title: 'Toolbar import',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: i % 4 }],
    })),
    syllables: [
      { id: 's1', text: 'Ky', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    ],
    divisions: [],
    clefChanges: [],
  },
};

// Reach the Division arrow by keyboard (Select, then End) and open its menu;
// returns the variant the menu focuses first.
async function openDivisionMenu(page: Page) {
  await tool(page, 'select').focus();
  await page.keyboard.press('End');
  await expect(divisionArrow(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(divisionArrow(page)).toHaveAttribute('aria-expanded', 'true');
  return focusedTool(page);
}

// Leave a roving stop and a remembered Division kind that a reset must clear.
async function dirtyPaletteMemory(page: Page) {
  expect(await openDivisionMenu(page)).toBe('minima');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(divisionArrow(page), 'choice returns focus').toBeFocused();
  await expect(divisionArrow(page)).toHaveAttribute(
    'data-active-variant',
    'minor',
  );
  // Global Escape returns to Select.
  await page.keyboard.press('Escape');
  await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
  expect(
    await openDivisionMenu(page),
    'menu reopens at the remembered kind',
  ).toBe('minor');
  await page.keyboard.press('Escape');
  await expect(divisionArrow(page), 'Escape closes the menu').toBeFocused();
  expect(await rovingStops(page)).toEqual(['division-menu']);
}

async function expectPaletteReset(page: Page, label: string) {
  expect(await rovingStops(page), `${label}: roving stop`).toEqual(['select']);
  expect(
    await openDivisionMenu(page),
    `${label}: remembered division kind resets`,
  ).toBe('minima');
  await page.keyboard.press('Escape');
  // Button refs stay live after replacement: arrow browsing still moves focus.
  await tool(page, 'select').focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    tool(page, 'punctum'),
    `${label}: refs still live`,
  ).toBeFocused();
  expect(await rovingStops(page)).toEqual(['punctum']);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(palette(page)).toBeVisible();
});

test('one roving stop; Arrow, Home and End browse and wrap without arming a tool', async ({
  page,
}) => {
  expect(await rovingStops(page)).toEqual(['select']);
  await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
  await tool(page, 'select').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tool(page, 'punctum')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tool(page, 'punctum-menu')).toBeFocused();
  await page.keyboard.press('End');
  await expect(divisionArrow(page)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tool(page, 'select')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(divisionArrow(page), 'ArrowLeft wraps').toBeFocused();
  expect(await rovingStops(page)).toEqual(['division-menu']);
  await expect(tool(page, 'select'), 'browsing never arms').toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('New, Import and recovery reload each reset the roving stop and the remembered Division kind', async ({
  page,
}) => {
  await dirtyPaletteMemory(page);
  await answerNextConfirm(page, true, () =>
    documentAction(page, 'New').click(),
  );
  await expect(page.locator('[data-note-id]')).toHaveCount(0);
  await expectPaletteReset(page, 'New');

  await dirtyPaletteMemory(page);
  await answerNextConfirm(page, true, () =>
    importThroughFileInput(page, JSON.stringify(importFixture)),
  );
  await expect(page.locator('[data-note-id]')).toHaveCount(6);
  await expectPaletteReset(page, 'Import');

  await dirtyPaletteMemory(page);
  // Controlled setup: a foreign autosave, as another tab would write; a
  // window focus makes the editor check the cache.
  await page.evaluate(
    ([key, text]) => {
      localStorage.setItem(key, text);
      window.dispatchEvent(new Event('focus'));
    },
    [
      storageKey,
      JSON.stringify({
        ...importFixture,
        document: { ...importFixture.document, title: 'Reloaded cache' },
      }),
    ] as const,
  );
  await answerNextConfirm(page, true, () =>
    recoveryAction(page, 'Load cached score').click(),
  );
  await expect(
    page.getByRole('button', { name: 'Edit chant title: Reloaded cache' }),
  ).toBeVisible();
  await expectPaletteReset(page, 'Reload');
});

test('T focuses the remembered tool without changing selection, and later browsing is not undone', async ({
  page,
}) => {
  await openWithCache(page, JSON.stringify(importFixture));
  const selected = () =>
    page.locator('.score [aria-pressed="true"], .note-context-toolbar').count();
  await page.locator('[data-note-id="note2"]').focus();
  const before = await selected();
  await page.keyboard.press('t');
  await expect(tool(page, 'punctum'), 'T reaches Punctum').toBeFocused();
  expect(await rovingStops(page)).toEqual(['punctum']);
  expect(await selected(), 'T changes no selection').toBe(before);
  // The handled request is not re-applied: browsing after T stays put.
  await page.keyboard.press('ArrowRight');
  await expect(tool(page, 'punctum-menu')).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(tool(page, 'punctum-menu'), 'not refocused').toBeFocused();

  // Arm a family variant by pointer; T then targets that family's menu.
  await tool(page, 'podatus-menu').click();
  await page
    .getByRole('menu', { name: 'Podatus family' })
    .locator('[data-variant="epiphonus"]')
    .click();
  await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(tool(page, 'select')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-note-id="note3"]').focus();
  await page.keyboard.press('t');
  await expect(
    tool(page, 'podatus-menu'),
    'T reaches the variant menu',
  ).toBeFocused();
});

test('the Quilisma figure select arms Quilisma and remembers the figure', async ({
  page,
}) => {
  const figure = page.getByRole('combobox', { name: 'Quilisma figure' });
  await figure.selectOption('scandicus');
  await expect(tool(page, 'quilisma')).toHaveAttribute('aria-pressed', 'true');
  await expect(figure).toHaveValue('scandicus');
  await page.keyboard.press('Escape');
  await expect(figure).toHaveValue('scandicus');
});

test('action bar Copy, Paste, Undo and Redo use the session commands and describe the passage', async ({
  page,
}) => {
  const copy = page.getByRole('button', { name: 'Copy selected music' });
  const paste = page.locator(
    '.editor-clipboard[aria-keyshortcuts^="Control+V"]',
  );
  await expect(copy, 'Copy needs a selection').toBeDisabled();
  await expect(paste).toHaveAttribute('aria-label', 'Paste (clipboard empty)');

  await openWithCache(page, JSON.stringify(importFixture));
  await page.locator('[data-note-id="note1"]').focus();
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#range-selection-status')).toHaveText(
    /^2 neumes selected/,
  );
  await expect(
    page.locator(
      '.editor-actions button[aria-describedby="range-selection-status"]',
    ),
    'Lyrics and Insert describe the passage status',
  ).toHaveCount(2);

  await copy.click();
  await expect(paste).toHaveAttribute('aria-label', 'Paste 2 copied neumes');
  const notes = page.locator('[data-note-id]');
  const before = await notes.count();
  await paste.click();
  await expect(notes).toHaveCount(before + 2);
  await undo(page).click();
  await expect(notes).toHaveCount(before);
  await redo(page).click();
  await expect(notes).toHaveCount(before + 2);
  await expect(page.locator('.editor-insert')).toHaveText(/^Insert .+ I$/);
});

// The sticky region leaves normal flow only when it fits: data-too-tall
// tracks a measured height above half the window, and windows 600px or
// shorter keep it static.
test('the sticky toolbar observer tracks its height at 1440px, 320px, a short window and 150% CSS zoom', async ({
  page,
}) => {
  const state = () =>
    page.locator('.editor-sticky-toolbar').evaluate((element) => ({
      flag: element.getAttribute('data-too-tall'),
      expected: String(
        element.getBoundingClientRect().height > window.innerHeight / 2,
      ),
      position: getComputedStyle(element).position,
    }));
  const tracks = async (label: string) => {
    await expect
      .poll(async () => {
        const s = await state();
        return s.flag === s.expected;
      }, label)
      .toBe(true);
    return state();
  };

  expect((await tracks('1440x1100')).flag).toBe('false');
  await page.setViewportSize({ width: 320, height: 1100 });
  await tracks('320x1100');
  await page.setViewportSize({ width: 320, height: 500 });
  const short = await tracks('320x500');
  expect(short.flag, 'short narrow window falls back').toBe('true');
  expect(short.position, 'fallback toolbar is not sticky').toBe('static');

  await page.setViewportSize({ width: 1440, height: 1100 });
  // Fixture setup: CSS zoom on the application.
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.style.zoom = '1.5';
  });
  await tracks('1440x1100 at 150% zoom');
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.style.zoom = '';
  });
  await tracks('1440x1100 after zoom');
});
