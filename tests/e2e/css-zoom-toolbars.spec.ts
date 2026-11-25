import { expect, test, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';

// Note and accidental properties panels under desktop, narrow, CSS zoom and
// browser (page) zoom, on the development fixture. Contract:
// docs/editor-interactions.md, "Sticky editing tools" (panels are placed from
// measured client bounds and scaled exactly once under CSS zoom, issue #112).
test.use({ baseURL: devOrigin });

// C clef on line 4: staff position 5 is B, so `b8` can own a flat.
const fixture = {
  title: 'CSS zoom contextual toolbars',
  clef: { type: 'c', staffLine: 4 },
  clefChanges: [],
  divisions: [],
  lyricLanguage: 'la',
  syllables: [],
  accidentals: [{ id: 'flat', kind: 'flat', ownerNoteId: 'b8' }],
  neumes: Array.from({ length: 16 }, (_, i) => ({
    id: `n${i}`,
    kind: 'punctum',
    notes: [
      { id: i === 8 ? 'b8' : `note${i}`, staffPosition: i === 8 ? 5 : 3 },
    ],
  })),
};

const targets = {
  note: {
    selector: '[data-note-id="note6"]',
    panel: 'Selected note properties',
    close: 'Close note properties',
  },
  accidental: {
    selector: '[data-accidental-id="flat"]',
    panel: 'Selected accidental properties',
    close: 'Close accidental properties',
  },
} as const;
type Target = (typeof targets)[keyof typeof targets];

// Put the target at a fraction of the viewport height, then click its centre
// natively; the panel must open.
async function open(page: Page, target: Target, fraction: number) {
  await mountDocument(page, fixture);
  const point = await page.locator(target.selector).evaluate((element, at) => {
    element.scrollIntoView({ block: 'center' });
    window.scrollBy(0, element.getBoundingClientRect().y - innerHeight * at);
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }, fraction);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('group', { name: target.panel })).toBeVisible();
}

// Rendered geometry in client (viewport) pixels.
const geometry = (page: Page, target: Target) =>
  page.evaluate((t) => {
    const panel = [
      ...document.querySelectorAll<HTMLElement>('[aria-label]'),
    ].find((e) => e.getAttribute('aria-label') === t.panel);
    const close = [...(panel?.querySelectorAll('button') ?? [])].find(
      (b) =>
        b.getAttribute('aria-label') === t.close ||
        b.textContent?.trim() === t.close,
    );
    const owner = document.querySelector(t.selector);
    if (!panel || !close || !owner)
      throw Error('Missing panel, Close or target');
    const p = panel.getBoundingClientRect();
    const o = owner.getBoundingClientRect();
    const s = document
      .querySelector('.editor-sticky-toolbar')
      ?.getBoundingClientRect();
    const c = close.getBoundingClientRect();
    const x = c.x + c.width / 2;
    const y = c.y + c.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      panel: { left: p.left, top: p.top, right: p.right, bottom: p.bottom },
      target: { left: o.left, top: o.top, right: o.right, bottom: o.bottom },
      sticky: s && s.bottom > 0 && s.top < innerHeight ? s.bottom : 0,
      viewport: {
        width: window.visualViewport?.width ?? innerWidth,
        height: window.visualViewport?.height ?? innerHeight,
      },
      close: { x, y, hit: !!hit && (hit === close || close.contains(hit)) },
      zoom:
        (panel as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ??
        1,
      style: {
        left: parseFloat(panel.style.left),
        top: parseFloat(panel.style.top),
      },
    };
  }, target);

const modes = [
  { name: 'desktop 1440', width: 1440, height: 1100, zoom: 1 },
  { name: 'narrow 320', width: 320, height: 1100, zoom: 1 },
  { name: '150% CSS zoom', width: 480, height: 1100, zoom: 1.5 },
] as const;

function definePanelTests(mode: {
  dpr?: number;
  name: string;
  zoom: number;
  size?: { width: number; height: number };
}) {
  for (const [kind, target] of Object.entries(targets))
    for (const fraction of [0.5, 0.85])
      test(`${mode.name}: the ${kind} panel opened at ${fraction * 100}% height stays in place and dismisses by pointer, Escape and keyboard`, async ({
        page,
      }) => {
        if (mode.size) await page.setViewportSize(mode.size);
        expect(await page.evaluate(() => window.devicePixelRatio)).toBe(
          mode.dpr ?? 1,
        );
        // Fixture setup: CSS zoom on the root element, as in issue #112.
        await page.evaluate(
          (zoom) => (document.documentElement.style.zoom = String(zoom)),
          mode.zoom,
        );
        for (const dismissal of ['pointer', 'escape', 'keyboard'] as const) {
          const label = `${kind} at ${fraction} by ${dismissal}`;
          await open(page, target, fraction);
          const panel = page.getByRole('group', { name: target.panel });
          // A panel shorter than its content scrolls internally (the short
          // window policy); reach Close within the panel, never the page.
          const pageMoved = await panel.evaluate((element, closeName) => {
            const y = window.scrollY;
            if (element.scrollHeight > element.clientHeight)
              [...element.querySelectorAll('button')]
                .find(
                  (b) =>
                    b.getAttribute('aria-label') === closeName ||
                    b.textContent?.trim() === closeName,
                )
                ?.scrollIntoView({ block: 'nearest' });
            return window.scrollY !== y;
          }, target.close);
          expect(pageMoved, `${label}: page scrolled`).toBe(false);

          const g = await geometry(page, target);
          const tol = 0.5;
          // CSS zoom is the panel's own; browser zoom must not appear as one.
          expect(g.zoom, `${label}: effective zoom`).toBe(mode.zoom);
          // Inline CSS pixels times the zoom are what is rendered: scaled once.
          expect(
            Math.abs(g.style.left * g.zoom - g.panel.left),
            label,
          ).toBeLessThanOrEqual(tol);
          expect(
            Math.abs(g.style.top * g.zoom - g.panel.top),
            label,
          ).toBeLessThanOrEqual(tol);
          // Inside the visual viewport, below the sticky tools, clear of the target.
          expect(g.panel.left, `${label}: left`).toBeGreaterThanOrEqual(-tol);
          expect(g.panel.right, `${label}: right`).toBeLessThanOrEqual(
            g.viewport.width + tol,
          );
          expect(g.panel.bottom, `${label}: bottom`).toBeLessThanOrEqual(
            g.viewport.height + tol,
          );
          expect(
            g.panel.top,
            `${label}: below the sticky tools`,
          ).toBeGreaterThanOrEqual(g.sticky - tol);
          expect(
            g.panel.bottom <= g.target.top + tol ||
              g.panel.top >= g.target.bottom - tol ||
              g.panel.right <= g.target.left + tol ||
              g.panel.left >= g.target.right - tol,
            `${label}: panel clear of its target ${JSON.stringify(g)}`,
          ).toBe(true);
          expect(g.close.hit, `${label}: Close is the hit target`).toBe(true);

          if (dismissal === 'pointer')
            await page.mouse.click(g.close.x, g.close.y);
          else if (dismissal === 'escape') {
            // Native Tab from the selected target enters the panel.
            await page.keyboard.press('Tab');
            expect(
              await panel.evaluate((element) =>
                element.contains(document.activeElement),
              ),
              `${label}: Tab enters the panel`,
            ).toBe(true);
            await page.keyboard.press('Escape');
          } else {
            await panel.getByRole('button', { name: target.close }).focus();
            await page.keyboard.press('Enter');
          }
          await expect(panel, `${label}: dismissed`).toBeHidden();
          await expect(
            page.locator(target.selector),
            `${label}: focus returns`,
          ).toBeFocused();
        }
      });
}

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
});

for (const mode of modes)
  test.describe(mode.name, () => {
    definePanelTests({
      name: mode.name,
      zoom: mode.zoom,
      size: { width: mode.width, height: mode.height },
    });
  });

// 150% browser zoom of a 480 × 1100 window: fewer CSS pixels and denser device
// pixels, with no CSS zoom.
test.describe('150% page zoom', () => {
  test.use({ viewport: { width: 320, height: 733 }, deviceScaleFactor: 1.5 });
  definePanelTests({ name: '150% page zoom', zoom: 1, dpr: 1.5 });
});
