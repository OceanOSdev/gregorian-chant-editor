import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import { frames } from './helpers/score.ts';

// Focus survives the system reparenting caused by reflow, on the production
// preview with the bundled Dominican Salve Regina at 1440 × 1100. Contract:
// docs/editor-interactions.md, "Focus" (registration callbacks, restoration
// by stable ID, no focus theft).
test.use({ baseURL: previewOrigin });

type Attribute = 'data-note-id' | 'data-syllable-id';

// System index of every note or lyric control, by ID.
const systemsById = (page: Page, attribute: Attribute) =>
  page.evaluate(
    (name) =>
      Object.fromEntries(
        [...document.querySelectorAll(`.score [${name}][role="button"]`)].map(
          (element) => [
            element.getAttribute(name),
            Number(
              element.closest<HTMLElement>('[data-system-index]')?.dataset
                .systemIndex,
            ),
          ],
        ),
      ),
    attribute,
  );

// Controlled setup: FontFaceSet events switch lyric measurement to its
// fallback ("loading") and back ("loadingdone"), which reflows the score as
// real font loading does. Wait for the re-render.
async function fonts(page: Page, type: 'loading' | 'loadingdone') {
  await page.evaluate(
    (name) => document.fonts.dispatchEvent(new Event(name)),
    type,
  );
  await frames(page);
  await frames(page);
}

// The focused element's ID for `attribute` and its system.
const focused = (page: Page, attribute: Attribute) =>
  page.evaluate((name) => {
    const element = document.activeElement;
    return element?.hasAttribute(name)
      ? {
          id: element.getAttribute(name),
          system: Number(
            element.closest<HTMLElement>('[data-system-index]')?.dataset
              .systemIndex,
          ),
        }
      : { id: null, system: Number.NaN };
  }, attribute);

// Controls whose system differs between measured and fallback layout.
async function movingControls(page: Page, attribute: Attribute) {
  const measured = await systemsById(page, attribute);
  await fonts(page, 'loading');
  const fallback = await systemsById(page, attribute);
  await fonts(page, 'loadingdone');
  await expect
    .poll(() => systemsById(page, attribute), 'measured layout returns')
    .toEqual(measured);
  return Object.keys(measured).filter(
    (id) => id in fallback && fallback[id] !== measured[id],
  );
}

// Focus the score tab stop before `selector` by script, then press a native
// Tab to arrive at it.
async function tabInto(page: Page, selector: string) {
  const ready = await page.evaluate((target) => {
    const stops = [
      ...document.querySelectorAll<SVGElement>('.score [tabindex="0"]'),
    ];
    const index = stops.indexOf(
      document.querySelector<SVGElement>(target) as SVGElement,
    );
    if (index < 1) return false;
    stops[index - 1].focus();
    return true;
  }, selector);
  expect(ready, `${selector} has a preceding score tab stop`).toBe(true);
  await frames(page);
  await page.keyboard.press('Tab');
}

async function expectSurvivesReparent(
  page: Page,
  attribute: Attribute,
  id: string,
) {
  const before = await focused(page, attribute);
  expect(before.id, 'focused before reflow').toBe(id);
  await fonts(page, 'loading');
  const during = await focused(page, attribute);
  expect(during.id, 'focus survives the fallback reparent').toBe(id);
  expect(during.system, 'the fallback really moves the control').not.toBe(
    before.system,
  );
  await fonts(page, 'loadingdone');
  await expect
    .poll(() => focused(page, attribute), 'returns to its system with focus')
    .toEqual(before);
}

const note = (id: string) => `.score [data-note-id="${id}"][role="button"]`;
const lyric = (id: string) =>
  `.score [data-syllable-id="${id}"][role="button"]`;

let notes: string[] = [];
let lyrics: string[] = [];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('combobox', { name: 'Load example' })
    .selectOption({ label: 'Salve Regina Dominican' });
  await expect(page.locator('[data-note-id]').first()).toBeAttached();
  expect(await page.locator('[data-note-id]').count()).toBeGreaterThan(100);
  // Start from settled measured layout: real fonts may still be loading.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  let settled = await systemsById(page, 'data-note-id');
  await expect
    .poll(async () => {
      const next = await systemsById(page, 'data-note-id');
      const same = JSON.stringify(next) === JSON.stringify(settled);
      settled = next;
      return same;
    }, 'measured layout settles')
    .toBe(true);
  notes = await movingControls(page, 'data-note-id');
  lyrics = await movingControls(page, 'data-syllable-id');
  expect(notes.length, 'fixture reparents at least two notes').toBeGreaterThan(
    1,
  );
  expect(lyrics.length, 'fixture reparents at least one lyric').toBeGreaterThan(
    0,
  );
});

test('a note reached by native Tab keeps focus through both reparents', async ({
  page,
}) => {
  await tabInto(page, note(notes[0]));
  await expectSurvivesReparent(page, 'data-note-id', notes[0]);
});

test('a note focused by script keeps focus through both reparents', async ({
  page,
}) => {
  await page.locator(note(notes[1])).focus();
  await expectSurvivesReparent(page, 'data-note-id', notes[1]);
});

// The legacy order: a different note is the score's last tracked focus
// (script-focused) before a lyric is reached by Tab. The lyric must keep focus
// rather than being redirected to that note.
test('a lyric reached by native Tab keeps focus through both reparents, even after another note had focus', async ({
  page,
}) => {
  await page.locator(note(notes[1])).focus();
  await tabInto(page, lyric(lyrics[0]));
  await expectSurvivesReparent(page, 'data-syllable-id', lyrics[0]);
});

test('reflow never takes focus from a palette button outside the score', async ({
  page,
}) => {
  const select = page
    .getByRole('toolbar', { name: 'Notation tools' })
    .locator('button[data-tool="select"]');
  await page.locator(note(notes[1])).focus();
  await select.focus();
  await expect(select).toBeFocused();
  await fonts(page, 'loading');
  await expect(select, 'no focus theft on the fallback reflow').toBeFocused();
  await fonts(page, 'loadingdone');
  await expect(select, 'no focus theft on the measured reflow').toBeFocused();
});
