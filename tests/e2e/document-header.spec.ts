import { expect, test } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import { titleButton, titleInput } from './helpers/preview-document.ts';
import { pageIsContained } from './helpers/score.ts';

// Document header presentation on the production preview: the local-saving
// disclosure, responsive containment and built asset paths. Contract:
// docs/persistence.md, "Document controls".
test.use({ baseURL: previewOrigin });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Document' })).toBeVisible();
});

test('"About local saving" is a closed native disclosure that opens and closes by pointer and keyboard', async ({
  page,
}) => {
  const header = page.locator('.document-header');
  const details = header.locator('details.document-header__help');
  const summary = details.locator('summary', { hasText: 'About local saving' });
  await expect(details).not.toHaveAttribute('open');
  await expect(
    details.getByText('Only committed edits are saved.'),
  ).toBeHidden();

  await summary.click();
  await expect(details).toHaveAttribute('open');
  await expect(
    details.getByText('Only committed edits are saved.'),
  ).toBeVisible();
  await summary.click();
  await expect(details).not.toHaveAttribute('open');

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open');
  await page.keyboard.press('Enter');
  await expect(details).not.toHaveAttribute('open');

  // The compact header has no fieldset chrome.
  await expect(header.locator('fieldset')).toHaveCount(0);
});

for (const width of [1440, 320]) {
  test(`the header stays inside the page at ${width}px, with a very long title being edited, committed and with help open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    expect(await pageIsContained(page)).toBe(true);

    await titleButton(page).click();
    await titleInput(page).fill(
      'Long chant title '.repeat(25) + 'L'.repeat(180),
    );
    expect(await pageIsContained(page), 'draft').toBe(true);
    await page.keyboard.press('Enter');
    await expect(titleButton(page)).toBeVisible();
    expect(await pageIsContained(page), 'committed').toBe(true);

    await page.locator('.document-header__help summary').click();
    await expect(page.locator('.document-header__help')).toHaveAttribute(
      'open',
    );
    expect(await pageIsContained(page), 'help open').toBe(true);
  });
}

test('built scripts and stylesheets load from /assets/', async ({ page }) => {
  const paths = await page
    .locator('script[src], link[rel="stylesheet"]')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          new URL(
            (element as HTMLScriptElement).src ||
              (element as HTMLLinkElement).href,
          ).pathname,
      ),
    );
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) expect(path).toMatch(/^\/assets\//);
});
