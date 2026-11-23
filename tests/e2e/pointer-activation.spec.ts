import { expect, test, type Locator, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';
import { punctumScore } from './helpers/punctum-score.ts';
import { centre, frames, revealCentered } from './helpers/score.ts';

// Issue #121: focus moves at a pointer press, but nothing derived from that
// focus may change layout or scroll before the press's click is dispatched.
test.use({ baseURL: devOrigin });

function score(count: number, divisionBefore: number) {
  return {
    title: 'Pointer activation',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 3 },
    neumes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      kind: 'punctum',
      notes: [{ id: `note${i}`, staffPosition: 2 }],
    })),
    clefChanges: [],
    divisions: [
      { id: 'D', kind: 'minima', beforeNeumeId: `n${divisionBefore}` },
    ],
    syllables: Array.from({ length: count }, (_, i) => ({
      id: `s${i}`,
      text: `syl${i}`,
      startsAtNeumeId: `n${i}`,
      boundaryBefore: 'word',
    })),
  };
}

const division = (page: Page) => page.locator('[data-division-id="D"]');
const divisionPanel = (page: Page) => page.locator('.division-controls');
const workspaceY = async (page: Page) =>
  (await page.locator('.score-workspace').boundingBox())?.y ?? Number.NaN;

async function pressAndHold(page: Page, target: Locator) {
  const point = await centre(target.locator('.score__division-target'));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(target).toBeFocused();
  await frames(page);
}

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
});

for (const width of [1440, 320]) {
  test(`division click selects without moving the score during the press at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await mountDocument(page, score(2, 1));
    await revealCentered(division(page));
    const before = await workspaceY(page);

    await pressAndHold(page, division(page));
    // Focus moved, but the focus-derived panel has not mounted yet.
    await expect(divisionPanel(page)).toHaveCount(0);
    expect(await workspaceY(page)).toBe(before);

    await page.mouse.up();
    await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(division(page)).toBeFocused();
    // After the click, the panel appears and may move the score.
    await expect(divisionPanel(page)).toBeVisible();
  });
}

test('division click just below the sticky tools on a scrolled page', async ({
  page,
}) => {
  await mountDocument(page, score(90, 70));
  // Fixture setup: scroll so the division's target starts just below the
  // sticky tools.
  await division(page).evaluate((element) => {
    const tools = document.querySelector('.editor-sticky-toolbar');
    const target = element.querySelector('.score__division-target');
    if (!tools || !target) throw Error('Missing sticky tools or target');
    for (let pass = 0; pass < 2; pass++)
      window.scrollBy(
        0,
        target.getBoundingClientRect().top -
          tools.getBoundingClientRect().bottom -
          4,
      );
  });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const scrollY = await page.evaluate(() => window.scrollY);

  await pressAndHold(page, division(page));
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.mouse.up();
  await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
});

test('reverse: clicking a note while a division has keyboard focus selects the note', async ({
  page,
}) => {
  await mountDocument(page, score(2, 1));
  await page.locator('[data-note-id="note1"]').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(division(page)).toBeFocused();
  await expect(divisionPanel(page)).toBeVisible();
  const before = await workspaceY(page);

  const note = page.locator('[data-note-id="note0"]');
  const point = await centre(note);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(note).toBeFocused();
  await frames(page);
  // The panel that followed the division's focus stays until the click.
  await expect(divisionPanel(page)).toBeVisible();
  expect(await workspaceY(page)).toBe(before);

  await page.mouse.up();
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await expect(divisionPanel(page)).toHaveCount(0);
});

test('a fast double-click never moves the score inside its second press', async ({
  page,
}) => {
  // A keyboard-focused division shows its panel; the first click (on a
  // lyric) leaves deferred presentation that would remove it. If the second
  // press arrives before the first click's settle task (seen in Chromium),
  // that presentation must wait for the second click instead of running
  // inside the second mousedown. If the task runs first (seen in Firefox),
  // the accepted post-click change lands between the clicks.
  await mountDocument(page, score(2, 1));
  await page.locator('[data-note-id="note1"]').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(divisionPanel(page)).toBeVisible();
  // Recording only: read the score position and targets around the press.
  await page.evaluate(() => {
    const record: string[] = [];
    Object.assign(window, { pressRecord: record });
    const y = () =>
      document.querySelector('.score-workspace')?.getBoundingClientRect().y;
    for (const type of ['mousedown', 'mouseup'])
      window.addEventListener(type, (event) => {
        const target = event.target as Element;
        record.push(
          `${type} ${y()} ${target.getAttribute('data-syllable-id') ?? target.className}`,
        );
      });
  });
  await page.locator('.score__lyric[data-syllable-id="s0"]').dblclick();
  const record = await page.evaluate(
    () => (window as unknown as { pressRecord: string[] }).pressRecord,
  );
  expect(record).toHaveLength(4);
  const [, , down, up] = record.map((entry) => entry.split(' '));
  // Same score position and same target from press to release.
  expect(up.slice(1)).toEqual(down.slice(1));
});

test('a syllable-strip button clipped at the strip edge opens on click', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mountDocument(page, score(30, 1));
  const strip = page.locator('.syllable-strip');
  await revealCentered(strip);
  // The first button that the strip's right edge clips; press its visible
  // part, 3 px inside the edge.
  const press = await strip.evaluate((element) => {
    const edge = element.getBoundingClientRect().right;
    const button = [...element.querySelectorAll('button')].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return box.left < edge - 6 && box.right > edge;
    });
    if (!button) throw Error('No clipped syllable button');
    const box = button.getBoundingClientRect();
    return {
      id: button.dataset.syllableId ?? '',
      x: edge - 3,
      y: box.y + box.height / 2,
    };
  });
  const scrollLeft = () => strip.evaluate((element) => element.scrollLeft);
  const before = await scrollLeft();

  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  await expect(
    strip.locator(`button[data-syllable-id="${press.id}"]`),
  ).toBeFocused();
  await frames(page);
  expect(await scrollLeft()).toBe(before);

  await page.mouse.up();
  await expect(page.locator('#lyric-input')).toBeVisible();
});

// A press 2 px inside a small lyric's edge, within the 8 px reveal margin at
// the bottom of the window and just below the sticky tools: any scroll during
// the press moves the lyric from under the pointer. The 700 px window leaves
// scroll range for both edges and keeps the tools sticky (above 600 px).
for (const edge of ['bottom', 'top'] as const) {
  test(`a lyric press inside the ${edge} reveal margin does not scroll, and its click selects the lyric`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    const chant = punctumScore(100);
    chant.syllables.push({
      id: 'edge',
      text: 'ta',
      startsAtNeumeId: 'n50',
      boundaryBefore: 'word',
    });
    await mountDocument(page, chant);
    const lyric = page.locator('.score__lyric[data-syllable-id="edge"]');

    // Fixture setup: place the lyric at the edge. The sticky tools pin once
    // the page scrolls, so settle twice.
    const press = await lyric.evaluate(async (element, edgeName) => {
      (document.activeElement as HTMLElement | null)?.blur();
      const toolsBottom = () =>
        window.document
          .querySelector('.editor-sticky-toolbar')
          ?.getBoundingClientRect().bottom ?? Number.NaN;
      for (let pass = 0; pass < 2; pass++) {
        const box = element.getBoundingClientRect();
        window.scrollTo(
          0,
          edgeName === 'bottom'
            ? box.bottom + window.scrollY - window.innerHeight + 3
            : box.top + window.scrollY - toolsBottom() - 3,
        );
        await new Promise(requestAnimationFrame);
      }
      const box = element.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = edgeName === 'bottom' ? box.bottom - 2 : box.top + 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        onTarget: hit !== null && element.contains(hit),
        inMargin:
          edgeName === 'bottom'
            ? window.innerHeight - box.bottom < 8
            : box.top - toolsBottom() < 8,
        scrollY: window.scrollY,
      };
    }, edge);
    expect(press.onTarget, 'the lyric is the pointer target').toBe(true);
    expect(press.inMargin, 'the lyric is inside the reveal margin').toBe(true);

    await page.mouse.move(press.x, press.y);
    await page.mouse.down();
    await expect(lyric).toBeFocused();
    await frames(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(press.scrollY);
    await page.mouse.up();
    // The click selects the lyric, not only focuses it.
    await expect(lyric).toHaveAttribute('aria-pressed', 'true');
  });
}

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('a tap selects a division', async ({ page }) => {
    await mountDocument(page, score(2, 1));
    await revealCentered(division(page));
    const point = await centre(
      division(page).locator('.score__division-target'),
    );
    await page.touchscreen.tap(point.x, point.y);
    await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(divisionPanel(page)).toBeVisible();
  });
});

test.describe('interrupted presses leave no held presentation', () => {
  test.beforeEach(async ({ page }) => {
    await mountDocument(page, score(2, 1));
    await revealCentered(division(page));
  });

  test('release away from the division: focused, not selected, panel shown after release', async ({
    page,
  }) => {
    await pressAndHold(page, division(page));
    const away = await centre(page.locator('.document-header'));
    await page.mouse.move(away.x, away.y);
    await page.mouse.up();
    // The click went to a common ancestor; the press settled with it.
    await expect(divisionPanel(page)).toBeVisible();
    await expect(division(page)).toBeFocused();
    await expect(division(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('a key press while the button is down keeps the hold, and the click still selects', async ({
    page,
  }) => {
    const before = await workspaceY(page);
    await pressAndHold(page, division(page));
    await page.keyboard.press('Shift');
    await frames(page);
    await expect(divisionPanel(page)).toHaveCount(0);
    expect(await workspaceY(page)).toBe(before);
    await page.mouse.up();
    await expect(division(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(divisionPanel(page)).toBeVisible();
  });

  test('release outside the window, then return: no click, hold settled', async ({
    page,
  }) => {
    // Chromium still delivers pointerup/mouseup/click (to a common
    // ancestor); Playwright Firefox delivers none and reports the pointer
    // without buttons on leaving the window. Either way the hold settles.
    await pressAndHold(page, division(page));
    await page.mouse.move(-20, -20);
    await page.mouse.up();
    await page.mouse.move(10, 10);
    await expect(divisionPanel(page)).toBeVisible();
    await expect(division(page)).toBeFocused();
    await expect(division(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('pointercancel settles at once', async ({ page }) => {
    await pressAndHold(page, division(page));
    // Controlled signal: Playwright cannot start a native touch scroll, which
    // is what normally cancels a press.
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent('pointercancel')),
    );
    await expect(divisionPanel(page)).toBeVisible();
    await page.mouse.up();
  });

  test('after an interrupted press, keyboard focus presentation is immediate', async ({
    page,
  }) => {
    await pressAndHold(page, division(page));
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent('pointercancel')),
    );
    await page.mouse.up();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-note-id="note1"]')).toBeFocused();
    // Focus left the division and nothing is selected: the panel goes at once.
    await expect(divisionPanel(page)).toHaveCount(0);
    await page.keyboard.press('Shift+Tab');
    await expect(division(page)).toBeFocused();
    await expect(divisionPanel(page)).toBeVisible();
    await expect(division(page)).toHaveAttribute('aria-pressed', 'false');
  });
});
