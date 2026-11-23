import { expect, test, type Page } from '@playwright/test';
import { previewOrigin } from './helpers/origins.ts';
import { cached, openWithCache } from './helpers/preview-document.ts';

// Issue #123 (M2.4): user-facing placement with the extended Scandicus and
// Climacus variants and the Quilisma figure, at a staff point the pointer can
// actually reach. The legacy driver hovered a fixed score point that the
// taller desktop sticky tools now cover; see
// docs/verification/issue-123/README.md. The full driver migration is M2.8.
// Contract: docs/editor-interactions.md, "Scandicus and Climacus family split
// controls (Stage 9B-2)" and "Palette and contextual keyboard insertion".
test.use({ baseURL: previewOrigin });

interface Note {
  id: string;
  staffPosition: number;
  form?: string;
}
interface Neume {
  id: string;
  kind: string;
  notes: Note[];
}

// A tall multi-system score, like the legacy driver's state when it failed.
const tallScore = JSON.stringify({
  format: 'gregorian-chant-editor',
  version: 10,
  document: {
    title: 'Issue 123 — extended Scandicus and Climacus',
    lyricLanguage: 'la',
    clef: { type: 'c', staffLine: 4 },
    neumes: Array.from({ length: 60 }, (_, i) => ({
      id: `p${i}`,
      kind: 'punctum',
      notes: [{ id: `p${i}-0`, staffPosition: 3 }],
    })),
    syllables: [],
    divisions: [],
    clefChanges: [],
    accidentals: [],
  },
});

const neumes = async (page: Page) =>
  ((await cached(page)) as { document: { neumes: Neume[] } }).document.neumes;
const tools = (page: Page) =>
  page.getByRole('toolbar', { name: 'Notation tools' });
const arrow = (page: Page, family: string) =>
  tools(page).locator(`button[data-tool="${family}-menu"]`);

// A point on the first system at the legacy driver's score x (300 units) and
// the given staff position, brought to the middle of the window so that it is
// below the sticky tools. Precondition: the score, not the tools, is the hit
// target there.
async function visibleStaffPoint(page: Page, position: number) {
  const point = await page.evaluate((staffPosition) => {
    const svg = document.querySelector<SVGSVGElement>('svg.score');
    if (!svg) throw Error('No score');
    const lines = [...svg.querySelectorAll('.score__staff-line')].slice(0, 4);
    const bottom = Math.max(...lines.map((l) => Number(l.getAttribute('y1'))));
    const at = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) throw Error('No screen CTM');
      return new DOMPoint(300, bottom - staffPosition * 12).matrixTransform(
        matrix,
      );
    };
    window.scrollBy(0, at().y - window.innerHeight / 2);
    const p = at();
    const hit = document.elementFromPoint(p.x, p.y);
    return {
      x: p.x,
      y: p.y,
      onScore: hit?.closest('svg.score') === svg,
    };
  }, position);
  expect(point.onScore, 'the score is the pointer target').toBe(true);
  return point;
}

const ghostPaths = (page: Page) => page.locator('.score__placement-ghost path');

for (const width of [1440, 320]) {
  test(`Quilisma figure Scandicus arms, previews and places a quilismatic Scandicus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await openWithCache(page, tallScore);
    expect(await page.locator('[data-system-index]').count()).toBeGreaterThan(
      1,
    );
    await page
      .getByRole('combobox', { name: 'Quilisma figure' })
      .selectOption('scandicus');
    await expect(
      tools(page).locator('button[data-tool="quilisma"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    const before = new Set((await neumes(page)).map((n) => n.id));
    const point = await visibleStaffPoint(page, 1);
    await page.mouse.move(point.x, point.y);
    await expect(ghostPaths(page).first()).toBeAttached();
    await page.mouse.down();
    await page.mouse.up();

    await expect
      .poll(async () => (await neumes(page)).filter((n) => !before.has(n.id)))
      .toHaveLength(1);
    const [added] = (await neumes(page)).filter((n) => !before.has(n.id));
    expect(added.kind).toBe('scandicus');
    expect(added.notes.map((n) => n.form ?? null)).toEqual([
      null,
      'quilisma',
      null,
    ]);
    // Placement stays armed after the commit.
    await expect(
      tools(page).locator('button[data-tool="quilisma"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test(`each extended variant chosen from its menu previews its ink and places its exact contour at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await openWithCache(page, tallScore);
    // Ghost paths per variant: the Scandicus staircase draws one body per
    // Pes/Punctum element; the Climacus a virga and one diamond per later note.
    const variants = [
      { variant: 'scandicus-4', name: 'Scandicus (4 notes)', ink: 2, first: 2 },
      { variant: 'scandicus-5', name: 'Scandicus (5 notes)', ink: 3, first: 2 },
      { variant: 'climacus-4', name: 'Climacus (4 notes)', ink: 4, first: 5 },
      { variant: 'climacus-5', name: 'Climacus (5 notes)', ink: 5, first: 5 },
    ];
    for (const { variant, name, ink, first } of variants) {
      const [family, count] = variant.split('-');
      await arrow(page, family).click();
      await page
        .getByRole('menu', {
          name: `${family[0].toUpperCase()}${family.slice(1)} family`,
        })
        .getByRole('menuitemradio', { name, exact: true })
        .click();
      await expect(arrow(page, family)).toHaveAttribute(
        'data-active-variant',
        variant,
      );

      const before = new Set((await neumes(page)).map((n) => n.id));
      const point = await visibleStaffPoint(page, first);
      await page.mouse.move(point.x, point.y);
      await expect(ghostPaths(page), variant).toHaveCount(ink);
      await page.mouse.down();
      await page.mouse.up();

      await expect
        .poll(async () => (await neumes(page)).filter((n) => !before.has(n.id)))
        .toHaveLength(1);
      const [added] = (await neumes(page)).filter((n) => !before.has(n.id));
      const sign = family === 'scandicus' ? 1 : -1;
      expect(added.kind, variant).toBe(family);
      expect(
        added.notes.map((n) => n.staffPosition),
        variant,
      ).toEqual(
        Array.from({ length: Number(count) }, (_, i) => first + sign * i),
      );
      await expect(arrow(page, family)).toHaveAttribute(
        'data-active-variant',
        variant,
      );
      await page.keyboard.press('Escape');
    }
  });
}
