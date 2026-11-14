import { hasValidLyricAnchors } from '../../../src/editor/domain/lyrics';
import {
  layoutChant,
  lyricJoinThreshold,
  compactNeumeInkGap,
  lyricJoinClearance,
  staffEndX,
  systemVerticalAdvance,
  firstSystemBottomStaffY,
  type ChantLayout,
} from '../../../src/editor/layout/layout-chant';
import {
  buildNeumeGeometry,
  interNeumeInkGap,
} from '../../../src/editor/layout/neume-geometry';
import {
  lyricFontSize,
  lyricTextExtents,
  alignLyricText,
  type MeasureLyricText,
} from '../../../src/editor/layout/lyric-text-metrics';
import type { CompositionCase } from './corpus';

export function inspectCorpusCase(
  sample: CompositionCase,
  layout: ChantLayout,
  measure: MeasureLyricText,
) {
  const errors: string[] = [];
  const check = (valid: boolean, message: string) => {
    if (!valid) errors.push(message);
  };
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-7;
  const { document } = sample;
  // Independent half-open interval oracle; membership is never persisted.
  const owners = new Map<string, string>();
  document.syllables.forEach((syllable, i) => {
    const start = document.neumes.findIndex(
      (n) => n.id === syllable.startsAtNeumeId,
    );
    const next = document.syllables[i + 1];
    const end = next
      ? document.neumes.findIndex((n) => n.id === next.startsAtNeumeId)
      : document.neumes.length;
    for (const n of document.neumes.slice(start, end))
      owners.set(n.id, syllable.id);
  });
  check(hasValidLyricAnchors(document), 'invalid lyric anchors');
  const expected = sample.words.flatMap((word) =>
    word.map((text, i) => ({
      text,
      boundaryBefore: i === 0 ? 'word' : 'continuation',
    })),
  );
  check(
    JSON.stringify(
      document.syllables.map(({ text, boundaryBefore }) => ({
        text,
        boundaryBefore,
      })),
    ) === JSON.stringify(expected),
    'word metadata differs from editorial corpus',
  );
  check(
    JSON.stringify(layout) === JSON.stringify(layoutChant(document, measure)),
    'non-deterministic layout',
  );
  check(
    JSON.stringify(
      layout.systems.flatMap((s) => s.neumes.map((n) => n.neumeId)),
    ) === JSON.stringify(document.neumes.map((n) => n.id)),
    'wrapping loses or reorders neumes',
  );
  const lyrics = layout.systems.flatMap((system) =>
    system.lyrics.map((lyric) => ({ lyric, system })),
  );
  const dash = lyricTextExtents(
    alignLyricText(
      { id: 'dash', text: '-', boundaryBefore: 'word', startsAtNeumeId: '' },
      'und',
      measure,
    ),
  );
  check(dash !== null, 'missing measured hyphen');
  for (const system of layout.systems) {
    check(system.neumes.length > 0, 'unexpected empty system');
    for (const [i, n] of system.neumes.entries()) {
      const semantic = document.neumes.find((s) => s.id === n.neumeId);
      if (!semantic) {
        errors.push('unknown neume');
        continue;
      }
      const original = buildNeumeGeometry(
        semantic.kind,
        semantic.notes.map((note) => note.staffPosition),
        n.bounds.x,
        firstSystemBottomStaffY + system.index * systemVerticalAdvance,
      );
      check(
        JSON.stringify(n.ink) === JSON.stringify(original.ink),
        'changed musical ink',
      );
      check(
        close(n.lyricAnchorX, original.lyricAnchorX),
        'changed musical anchor',
      );
      check(
        JSON.stringify(
          n.notes.map(({ noteId, ...note }) => {
            void noteId;
            return note;
          }),
        ) === JSON.stringify(original.notes),
        'changed note geometry or internal target',
      );
      check(
        n.bounds.x + n.bounds.width <= staffEndX,
        'neume crosses wrap boundary',
      );
      const previous = system.neumes[i - 1];
      if (previous) {
        const gap = n.bounds.x - previous.bounds.x - previous.bounds.width;
        check(gap > 0, 'intersecting neume ink');
        const a = document.syllables.find(
            (s) => s.startsAtNeumeId === previous.neumeId,
          ),
          b = document.syllables.find((s) => s.startsAtNeumeId === n.neumeId);
        const sameSyllable =
          owners.has(n.neumeId) &&
          owners.get(n.neumeId) === owners.get(previous.neumeId);
        const blocked =
          document.divisions.some((d) => d.beforeNeumeId === n.neumeId) ||
          document.clefChanges.some((c) => c.beforeNeumeId === n.neumeId) ||
          !!previous.accidentals?.length ||
          !!n.accidentals?.length;
        if (sameSyllable && !blocked)
          check(gap >= 6 - 1e-7, 'insufficient intra-syllable ink clearance');
        else if (!a || !b || b.boundaryBefore === 'word')
          check(
            gap >= interNeumeInkGap - 1e-7,
            'compressed ineligible or word boundary',
          );
        const right = Math.max(
          ...previous.notes.map((note) =>
            Math.min(
              note.hitBounds.x + note.hitBounds.width,
              previous.hitClip?.right ?? Infinity,
            ),
          ),
        );
        const left = Math.min(
          ...n.notes.map((note) =>
            Math.max(note.hitBounds.x, n.hitClip?.left ?? -Infinity),
          ),
        );
        check(right <= left + 1e-7, 'ambiguous neighboring hit targets');
      }
      if (n.hitClip)
        check(
          n.hitClip.left < n.bounds.x &&
            n.hitClip.right > n.bounds.x + n.bounds.width,
          'clipped visible musical ink',
        );
    }
  }
  const boundaries = [];
  const expectedMarks = new Map(layout.systems.map((s) => [s.index, 0]));
  const expectedOutgoing = new Map(layout.systems.map((s) => [s.index, 0]));
  for (let i = 0; i < lyrics.length; i++) {
    const { lyric, system } = lyrics[i];
    const anchor = system.neumes.find(
      (n) => n.neumeId === document.syllables[i]?.startsAtNeumeId,
    );
    check(
      anchor !== undefined && close(lyric.anchorX, anchor.lyricAnchorX),
      'lost vowel-to-musical anchor',
    );
    check(
      close(lyric.x, lyric.anchorX + lyric.alignment.offset),
      'independently shifted lyric',
    );
    check(lyric.alignment.measured, 'unmeasured corpus text');
    if (i === 0) continue;
    const before = lyrics[i - 1];
    const outgoing = before.system.index !== system.index;
    const gap = Number(lyric.left) - Number(before.lyric.right);
    const word = lyric.boundaryBefore === 'word';
    if (!outgoing) {
      check(gap >= 0, 'intersecting lyric occupied bounds');
      if (word)
        check(
          gap >= lyricFontSize / 4 - 1e-7,
          'insufficient real word spacing',
        );
    }
    let minimumPermittedGap: number | null = null;
    const previousNeume = before.system.neumes.find(
      (n) => n.lyricAnchorX === before.lyric.anchorX,
    );
    const at = document.neumes.findIndex((n) => n.id === anchor?.neumeId);
    const semantic = document.neumes[at];
    if (
      !word &&
      !outgoing &&
      previousNeume &&
      semantic &&
      document.neumes[at - 1]?.id === previousNeume.neumeId
    ) {
      const safe = buildNeumeGeometry(
        semantic.kind,
        semantic.notes.map((n) => n.staffPosition),
        previousNeume.bounds.x +
          previousNeume.bounds.width +
          compactNeumeInkGap,
        firstSystemBottomStaffY + system.index * systemVerticalAdvance,
      );
      const extents = lyricTextExtents(lyric.alignment);
      if (extents) {
        minimumPermittedGap = Math.max(
          lyricJoinClearance,
          safe.lyricAnchorX + extents.left - Number(before.lyric.right),
        );
        if (minimumPermittedGap <= lyricJoinThreshold + 1e-7)
          check(
            gap <= lyricJoinThreshold + 1e-7,
            'missed geometrically feasible join',
          );
      }
    }
    const marked = !word && (outgoing || gap > lyricJoinThreshold);
    if (!word && !outgoing && dash) {
      const marks = before.system.hyphens.filter(
        (h) =>
          !h.outgoing &&
          h.x + dash.left >= Number(before.lyric.right) &&
          h.x + dash.right <= Number(lyric.left),
      );
      check(
        marks.length === (marked ? 1 : 0),
        'hyphen does not match continuation interval',
      );
    }
    if (marked && !outgoing && minimumPermittedGap !== null && dash)
      check(
        close(
          gap,
          Math.max(
            minimumPermittedGap,
            dash.right - dash.left + lyricFontSize / 5,
          ),
        ),
        'hyphen reserves unnecessary extra spacing',
      );
    if (marked && outgoing)
      expectedOutgoing.set(
        before.system.index,
        (expectedOutgoing.get(before.system.index) ?? 0) + 1,
      );
    if (marked)
      expectedMarks.set(
        before.system.index,
        (expectedMarks.get(before.system.index) ?? 0) + 1,
      );
    if (!word && !outgoing && !marked)
      check(
        gap < lyricFontSize / 4,
        'unmarked continuation as wide as minimum word space',
      );
    boundaries.push({
      beforeId: before.lyric.syllableId,
      afterId: lyric.syllableId,
      before: before.lyric.text,
      after: lyric.text,
      minimumPermittedGap,
      boundaryBefore: lyric.boundaryBefore,
      gap: outgoing ? null : gap,
      kind: word ? 'word' : outgoing ? 'outgoing' : marked ? 'hyphen' : 'join',
      sourceSystem: before.system.index,
    });
  }
  for (const system of layout.systems) {
    check(
      system.hyphens.length === expectedMarks.get(system.index),
      'missing or redundant hyphen',
    );
    check(
      system.hyphens.filter((h) => h.outgoing).length ===
        expectedOutgoing.get(system.index),
      'incorrect outgoing mark ownership',
    );
    for (const h of system.hyphens)
      if (dash) {
        const left = h.x + dash.left,
          right = h.x + dash.right;
        check(right <= staffEndX, 'hyphen crosses wrap boundary');
        check(
          system.lyrics.every(
            (l) =>
              right <= Number(l.left) + 1e-7 || left >= Number(l.right) - 1e-7,
          ),
          'hyphen intersects lyric',
        );
        if (h.outgoing)
          check(
            system.neumes.every((n) => left >= n.bounds.x + n.bounds.width),
            'outgoing mark overlaps musical horizontal extent',
          );
      }
  }
  return { errors, boundaries };
}
