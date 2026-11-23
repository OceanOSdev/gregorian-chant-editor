import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { mountDocument, openDevFixture } from './helpers/dev-fixture.ts';
import { devOrigin } from './helpers/origins.ts';

// Issue #123 (M2.4): selection and interaction cues on compact neighbours.
// Contract: docs/layout-and-rendering.md, "Compact neighbors receive derived
// horizontal hitClip ownership intervals …". Placement-context and lyric-move
// rectangles are clipped to the ownership interval; the whole-neume selection
// outline is fitted inside it and never clipped (since 4a363ce, PR #87). The
// legacy driver still required a clip on the outline; see
// docs/verification/issue-123/README.md. The full driver migration is M2.10.
test.use({ baseURL: devOrigin });

const kinds = [
  ['punctum', [2]],
  ['podatus', [2, 4]],
  ['clivis', [4, 2]],
  ['scandicus', [1, 2, 4]],
  ['torculus', [2, 4, 3]],
  ['climacus', [4, 3, 2]],
  ['porrectus', [4, 2, 3]],
] as const;

// Two neumes of one kind on the compact melisma "le-lu".
const compactPair = (kind: string, contour: readonly number[]) => ({
  title: 'Issue 123 — compact neighbours',
  lyricLanguage: 'la',
  clef: { type: 'c', staffLine: 3 },
  clefChanges: [],
  divisions: [],
  neumes: [0, 1].map((i) => ({
    id: `n${i}`,
    kind,
    notes: contour.map((p, j) => ({ id: `note${i}-${j}`, staffPosition: p })),
  })),
  syllables: [
    { id: 's0', text: 'le', startsAtNeumeId: 'n0', boundaryBefore: 'word' },
    {
      id: 's1',
      text: 'lu',
      startsAtNeumeId: 'n1',
      boundaryBefore: 'continuation',
    },
  ],
});

// Client point for a note: the centre of its hit target, clamped into its
// neume's ownership interval (the clip rectangle), as the legacy driver did
// with the layout's hitClip.
const notePoint = (page: Page, noteId: string) =>
  page.locator(`[data-note-id="${noteId}"]`).evaluate((note) => {
    const target = note.querySelector<SVGGraphicsElement>(
      '.score__note-hit-target',
    );
    const owner = note.closest('[data-neume-id]');
    const svg = note.closest('svg');
    if (!target || !owner || !svg) throw Error('Missing note geometry');
    const box = target.getBBox();
    let x = box.x + box.width / 2;
    const clip = owner.querySelector(':scope > defs clipPath rect');
    if (clip) {
      const left = Number(clip.getAttribute('x'));
      const right = left + Number(clip.getAttribute('width'));
      x = Math.max(left, Math.min(right, x));
    }
    const matrix = svg.getScreenCTM();
    if (!matrix) throw Error('No screen CTM');
    const p = new DOMPoint(x, box.y + box.height / 2).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  });

async function revealScore(page: Page) {
  await page
    .locator('svg.score')
    .evaluate((svg) => svg.scrollIntoView({ block: 'center' }));
}

// Geometry of a cue rectangle relative to its neume's ink, its ownership
// interval and its neighbour's ink, in SVG user units.
const cueGeometry = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((cue) => {
      const owner = cue.closest('[data-neume-id]');
      if (!owner || !(cue instanceof SVGRectElement)) throw Error('No cue');
      const ink = owner
        .querySelector<SVGGraphicsElement>(':scope > .score__ink')
        ?.getBBox();
      const neighbours = [
        owner.previousElementSibling,
        owner.nextElementSibling,
      ].flatMap((n) => {
        const box = n
          ?.querySelector<SVGGraphicsElement>(':scope > .score__ink')
          ?.getBBox();
        return box ? [box] : [];
      });
      const clipRect = owner.querySelector(':scope > defs clipPath rect');
      const half = Number(cue.getAttribute('stroke-width') ?? 0) / 2;
      const left = cue.x.baseVal.value;
      const right = left + cue.width.baseVal.value;
      if (!ink) throw Error('No ink');
      return {
        // Ownership clipping: the cue's own clip or one on an element between
        // it and its neume group. (Every system's music group also carries a
        // vertical band clip since Stage 11B; that is not ownership clipping.)
        clipPath: (() => {
          for (let e: Element | null = cue; e; e = e.parentElement) {
            const clip = e.getAttribute('clip-path');
            if (clip) return clip;
            if (e === owner) return null;
          }
          return null;
        })(),
        ownClipId: clipRect?.parentElement?.id ?? null,
        ownership: clipRect
          ? {
              left: Number(clipRect.getAttribute('x')),
              right:
                Number(clipRect.getAttribute('x')) +
                Number(clipRect.getAttribute('width')),
            }
          : null,
        outerLeft: left - half,
        outerRight: right + half,
        inkLeft: ink.x,
        inkRight: ink.x + ink.width,
        neighbours: neighbours.map((b) => ({
          left: b.x,
          right: b.x + b.width,
        })),
      };
    });

test.beforeEach(async ({ page }) => {
  await openDevFixture(page);
});

for (const width of [1440, 320]) {
  for (const [kind, contour] of kinds) {
    test(`${kind}: compact selection, placement and lyric-move cues follow the ownership contract at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1100 });
      await mountDocument(page, compactPair(kind, contour));
      await revealScore(page);

      // Every constituent is selectable by native pointer input.
      const noteIds = [0, 1].flatMap((i) =>
        contour.map((_, j) => `note${i}-${j}`),
      );
      for (const id of noteIds) {
        const closePanel = page.getByRole('button', {
          name: 'Close note properties',
        });
        if (await closePanel.isVisible()) await closePanel.click();
        const point = await notePoint(page, id);
        await page.mouse.click(point.x, point.y);
        await expect(
          page.locator(`[data-note-id="${id}"]`),
          id,
        ).toHaveAttribute('aria-pressed', 'true');
      }

      // Shift-click selects the whole following neume.
      const closePanel = page.getByRole('button', {
        name: 'Close note properties',
      });
      if (await closePanel.isVisible()) await closePanel.click();
      const last = await notePoint(page, noteIds[noteIds.length - 1]);
      await page.keyboard.down('Shift');
      await page.mouse.click(last.x, last.y);
      await page.keyboard.up('Shift');
      await expect(page.locator('.score__neume-selection')).toHaveCount(1);

      // Whole-neume outline: fitted, never clipped; its outer stroke edges
      // enclose its own ink, stay inside its ownership interval and never
      // reach the neighbouring ink.
      const outline = await cueGeometry(page, '.score__neume-selection');
      expect(outline.clipPath, 'outline is not clipped').toBeNull();
      expect(outline.outerLeft).toBeLessThanOrEqual(outline.inkLeft + 0.05);
      expect(outline.outerRight).toBeGreaterThanOrEqual(
        outline.inkRight - 0.05,
      );
      if (outline.ownership) {
        expect(outline.outerLeft).toBeGreaterThanOrEqual(
          outline.ownership.left - 0.01,
        );
        expect(outline.outerRight).toBeLessThanOrEqual(
          outline.ownership.right + 0.01,
        );
      }
      for (const n of outline.neighbours)
        expect(
          n.left >= outline.outerRight - 0.01 ||
            n.right <= outline.outerLeft + 0.01,
          'outline does not reach neighbouring ink',
        ).toBe(true);

      // Placement context around the selected neume: clipped to ownership.
      await page
        .getByRole('toolbar', { name: 'Notation tools' })
        .getByRole('button', { name: 'Punctum', exact: true })
        .click();
      const context = await cueGeometry(page, '.score__placement-context');
      expect(
        context.ownership,
        'compact neighbours have ownership',
      ).not.toBeNull();
      expect(context.clipPath).toBe(`url(#${context.ownClipId})`);

      // Lyric-move targets: clipped to ownership.
      await page.keyboard.press('Escape');
      // The selected neume's properties panel can cover the lyric; close it
      // natively first (the legacy driver dispatched its lyric click instead).
      if (await closePanel.isVisible()) await closePanel.click();
      await page.locator('.score__lyric[data-syllable-id="s0"]').click();
      await page.getByRole('button', { name: /^Move syllable:/ }).click();
      await expect(page.locator('.score__move-target').first()).toBeAttached();
      const move = await cueGeometry(page, '.score__move-target');
      expect(move.clipPath).toBe(`url(#${move.ownClipId})`);
    });
  }
}

// Issue #123 (M2.4), the second failure hidden behind the outline check: the
// driver's shared intra-syllable review clicked a Kyrie XI flat at its current
// client position without scrolling, so since the sticky tools (7062268) the
// click landed on the palette. Contract: docs/editor-interactions.md,
// "Contextual B accidentals (Stage 8D)" (a click selects an accidental).
test.describe('Kyrie XI melisma flat', () => {
  const kyrieUrl = new URL(
    '../../src/editor/examples/Kyrie-XI.chant.json',
    import.meta.url,
  );

  for (const width of [1440, 320]) {
    test(`a native click selects the first melisma flat, then the adjacent note, at ${width}px`, async ({
      page,
    }) => {
      const { document } = JSON.parse(await readFile(kyrieUrl, 'utf8')) as {
        document: {
          neumes: { id: string; notes: { id: string }[] }[];
          accidentals: { id: string; placement: { noteId: string } }[];
        };
      };
      const flat = document.accidentals[0];
      const at = document.neumes.findIndex((n) =>
        n.notes.some((note) => note.id === flat.placement.noteId),
      );
      const adjacent = document.neumes[at + 1].notes[0].id;

      await page.setViewportSize({ width, height: 1100 });
      await mountDocument(page, document);
      const accidental = page.locator(`[data-accidental-id="${flat.id}"]`);
      // Playwright scrolls the target clear of the sticky tools before it
      // presses, and fails if anything else would receive the click.
      await accidental.locator('.score__accidental-target').click();
      await expect(accidental).toHaveAttribute('aria-pressed', 'true');

      const closePanel = page.getByRole('button', {
        name: 'Close note properties',
      });
      if (await closePanel.isVisible()) await closePanel.click();
      const note = page.locator(`[data-note-id="${adjacent}"]`);
      await note.locator('.score__note-hit-target').click();
      await expect(note).toHaveAttribute('aria-pressed', 'true');
      await expect(accidental).toHaveAttribute('aria-pressed', 'false');
    });
  }
});
