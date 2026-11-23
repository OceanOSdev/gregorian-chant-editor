import { expect, type Locator, type Page } from '@playwright/test';

// Rendered semantic order of neumes and divisions, by their stable IDs.
export function scoreOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-neume-id], [data-division-id]')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.getAttribute('data-neume-id') ??
          element.getAttribute('data-division-id') ??
          '',
      ),
    );
}

// Fixture setup: centre the target in the window and in a horizontally
// scrolled score viewport before native pointer input. Firefox's
// scrollIntoView does not scroll the score viewport for an SVG group, so that
// container is centred explicitly.
export const revealCentered = (locator: Locator) =>
  locator.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const viewport = element.closest('.score-viewport');
    if (!viewport) return;
    const box = element.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    viewport.scrollLeft += box.x + box.width / 2 - (frame.x + frame.width / 2);
  });

// Wait for rendering, not time: two frames let React commit and run any
// requestAnimationFrame reveal scheduled by the previous input.
export const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

export async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw Error('No bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// The page itself never scrolls horizontally; wide scores scroll locally.
export const pageIsContained = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

// Selection is exposed as aria-pressed on the selected score element.
export const selectedNoteId = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector<HTMLElement>('[aria-pressed="true"][data-note-id]')
        ?.dataset.noteId ?? null,
  );
