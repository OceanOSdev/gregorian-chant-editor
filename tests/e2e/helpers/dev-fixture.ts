import { expect, type Page } from '@playwright/test';

// The development-only fixture page mounts the real StrictMode ChantEditor
// with a supplied document. It exists only on the Vite dev server.
const fixturePath = '/docs/verification/placement/browser-fixture.html';

declare global {
  interface Window {
    mountChantFixture?: (document: unknown) => void;
  }
}

export async function openDevFixture(page: Page): Promise<void> {
  await page.goto(fixturePath);
  await page.waitForFunction(
    () => typeof window.mountChantFixture === 'function',
  );
}

// Controlled fixture setup: mounting a document has no user-facing route.
// Each mount is a fresh editor session (new history, cleared autosave).
export async function mountDocument(
  page: Page,
  document: unknown,
): Promise<void> {
  await page.evaluate((doc) => window.mountChantFixture?.(doc), document);
  await expect(
    page.getByRole('toolbar', { name: 'Notation tools' }),
  ).toBeVisible();
}
