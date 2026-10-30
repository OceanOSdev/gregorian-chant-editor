import { describe, expect, it } from 'vitest';
import {
  staffPosition,
  type ChantDocument,
  type ClivisNeume,
  type Neume,
  type PodatusNeume,
  type PunctumNeume,
  type ScandicusNeume,
  type TorculusNeume,
} from '../domain/chant-document';
import { deleteNeume } from '../commands/delete-neume';
import { deleteNote } from '../commands/delete-note';
import { insertClivis } from '../commands/insert-clivis';
import { moveNeumeVertically } from '../commands/move-neume';
import {
  applyDocumentEdit,
  createDocumentHistory,
  redoDocumentEdit,
  undoDocumentEdit,
} from '../state/document-history';
import {
  getNeumeBoundaryCenterX,
  layoutChant,
  type NoteLayout,
} from './layout-chant';

function punctum(id: string, position: number): PunctumNeume {
  return {
    id: `neume-${id}`,
    kind: 'punctum',
    notes: [{ id, staffPosition: staffPosition(position) }],
  };
}

function podatus(
  id: string,
  lowerPosition: number,
  upperPosition: number,
): PodatusNeume {
  return {
    id: `neume-${id}`,
    kind: 'podatus',
    notes: [
      {
        id: `${id}-lower`,
        staffPosition: staffPosition(lowerPosition),
      },
      {
        id: `${id}-upper`,
        staffPosition: staffPosition(upperPosition),
      },
    ],
  };
}

function clivis(
  id: string,
  upperPosition: number,
  lowerPosition: number,
): ClivisNeume {
  return {
    id: `neume-${id}`,
    kind: 'clivis',
    notes: [
      {
        id: `${id}-upper`,
        staffPosition: staffPosition(upperPosition),
      },
      {
        id: `${id}-lower`,
        staffPosition: staffPosition(lowerPosition),
      },
    ],
  };
}

function scandicus(
  id: string,
  firstPosition: number,
  secondPosition: number,
  thirdPosition: number,
): ScandicusNeume {
  return {
    id: `neume-${id}`,
    kind: 'scandicus',
    notes: [
      { id: `${id}-first`, staffPosition: staffPosition(firstPosition) },
      { id: `${id}-middle`, staffPosition: staffPosition(secondPosition) },
      { id: `${id}-final`, staffPosition: staffPosition(thirdPosition) },
    ],
  };
}

function torculus(
  id: string,
  firstPosition: number,
  secondPosition: number,
  thirdPosition: number,
): TorculusNeume {
  return {
    id: `neume-${id}`,
    kind: 'torculus',
    notes: [
      { id: `${id}-first`, staffPosition: staffPosition(firstPosition) },
      { id: `${id}-second`, staffPosition: staffPosition(secondPosition) },
      { id: `${id}-third`, staffPosition: staffPosition(thirdPosition) },
    ],
  };
}

function createDocument(neumes: Neume[]): ChantDocument {
  return {
    title: 'Test chant',
    clef: { type: 'c', staffLine: 3 },
    syllables: neumes.length
      ? [
          {
            id: 'syllable-1',
            text: 'Ky',
            startsAtNeumeId: neumes[0].id,
            boundaryBefore: 'word',
          },
        ]
      : [],
    neumes,
  };
}

function noteCenterY(note: NoteLayout) {
  return note.anchorY;
}

function noteCenterX(note: NoteLayout) {
  return note.anchorX;
}

describe('layoutChant', () => {
  it('produces four staff lines and places staff position zero on the bottom line', () => {
    const layout = layoutChant(createDocument([punctum('note-1', 0)]));
    const staffLines = layout.systems[0]?.staffLines ?? [];
    const note = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0];

    expect(staffLines).toHaveLength(4);
    expect(note).toBeDefined();
    expect(note ? noteCenterY(note) : undefined).toBe(
      Math.max(...staffLines.map((line) => line.y)),
    );
  });

  it('moves each staff position by half a staff-line interval', () => {
    const layout = layoutChant(
      createDocument([punctum('note-1', 0), punctum('note-2', 1)]),
    );
    const lower = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes[0];
    const upper = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];
    const staffYs = (layout.systems[0]?.staffLines ?? [])
      .map((line) => line.y)
      .sort((first, second) => first - second);

    if (
      !lower ||
      !upper ||
      staffYs[0] === undefined ||
      staffYs[1] === undefined
    ) {
      throw new Error('Missing layout geometry');
    }

    expect(noteCenterY(lower) - noteCenterY(upper)).toBe(
      (staffYs[1] - staffYs[0]) / 2,
    );
  });

  it('preserves neume and note identity in nested layout data', () => {
    const layout = layoutChant(createDocument([punctum('note-1', 2)]));

    expect(layout.systems.flatMap((system) => system.neumes)[0]).toMatchObject({
      neumeId: 'neume-note-1',

      kind: 'punctum',
    });
    expect(
      layout.systems.flatMap((system) => system.neumes)[0]?.notes[0]?.noteId,
    ).toBe('note-1');
  });

  it('places Podatus notes closer than notes in separate neumes', () => {
    const separateLayout = layoutChant(
      createDocument([punctum('separate-1', 2), punctum('separate-2', 4)]),
    );
    const podatusLayout = layoutChant(
      createDocument([podatus('podatus', 2, 4)]),
    );
    const separateNotes = separateLayout.systems
      .flatMap((system) => system.neumes)
      .flatMap((neume) => neume.notes);
    const podatusNotes = podatusLayout.systems.flatMap(
      (system) => system.neumes,
    )[0]?.notes;
    const separateFirst = separateNotes[0];
    const separateSecond = separateNotes[1];
    const lower = podatusNotes?.[0];
    const upper = podatusNotes?.[1];

    if (!separateFirst || !separateSecond || !lower || !upper) {
      throw new Error('Missing note layout');
    }

    expect(noteCenterX(upper) - noteCenterX(lower)).toBeLessThan(
      noteCenterX(separateSecond) - noteCenterX(separateFirst),
    );
  });

  it('uses compact spacing and the expected visual contour for both two-note kinds', () => {
    const layout = layoutChant(
      createDocument([podatus('podatus', 2, 4), clivis('clivis', 5, 3)]),
    );
    const podatusNotes = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes;
    const clivisNotes = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes;
    const podatusFirst = podatusNotes?.[0];
    const podatusSecond = podatusNotes?.[1];
    const clivisFirst = clivisNotes?.[0];
    const clivisSecond = clivisNotes?.[1];

    if (!podatusFirst || !podatusSecond || !clivisFirst || !clivisSecond) {
      throw new Error('Missing two-note neume layout');
    }

    expect(noteCenterX(podatusSecond) - noteCenterX(podatusFirst)).toBe(0);
    expect(noteCenterX(clivisSecond) - noteCenterX(clivisFirst)).toBe(10.5);
    expect(noteCenterY(podatusSecond)).toBeLessThan(noteCenterY(podatusFirst));
    expect(noteCenterY(clivisFirst)).toBeLessThan(noteCenterY(clivisSecond));
  });

  it('places the following neume after the compact rendered width and normal gap', () => {
    const layout = layoutChant(
      createDocument([podatus('podatus', 2, 4), punctum('following', 3)]),
    );
    const podatusNotes = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes;
    const following = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];
    const lower = podatusNotes?.[0];
    const upper = podatusNotes?.[1];

    if (!lower || !upper || !following) {
      throw new Error('Missing note layout');
    }

    const normalInterNeumeGap = 33;

    expect(following.x - (upper.x + upper.width)).toBe(normalInterNeumeGap);
    expect(following.x).toBeGreaterThanOrEqual(upper.x + upper.width);
    expect(noteCenterX(following) - noteCenterX(lower)).toBeLessThan(96);
  });

  it('renders engraved compound ink as one continuous outline', () => {
    for (const neume of [podatus('pes', 2, 3), clivis('flexa', 3, 2)]) {
      const engraved = layoutChant(createDocument([neume])).systems[0]
        .neumes[0];
      expect(engraved.ink).toHaveLength(1);
      expect(engraved.ink[0].kind).toBe('path');
      expect(engraved).not.toHaveProperty('connectors');
    }
  });

  it('lays out a Scandicus with a fitted upper column in musical order', () => {
    const neumeLayout = layoutChant(
      createDocument([scandicus('scandicus', 2, 4, 7)]),
    ).systems.flatMap((system) => system.neumes)[0];
    const first = neumeLayout?.notes[0];
    const middle = neumeLayout?.notes[1];
    const final = neumeLayout?.notes[2];

    if (!neumeLayout || !first || !middle || !final) {
      throw new Error('Missing Scandicus layout');
    }

    expect(neumeLayout).toMatchObject({
      neumeId: 'neume-scandicus',

      kind: 'scandicus',
    });
    expect(neumeLayout.notes.map((note) => note.noteId)).toEqual([
      'scandicus-first',
      'scandicus-middle',
      'scandicus-final',
    ]);
    expect(middle.anchorX - first.anchorX).toBe(10.5);
    expect(final.anchorX - middle.anchorX).toBe(0);
    expect(noteCenterY(first)).toBeGreaterThan(noteCenterY(middle));
    expect(noteCenterY(middle)).toBeGreaterThan(noteCenterY(final));
    expect(neumeLayout.ink).toHaveLength(1);
    expect(neumeLayout.bounds).toMatchObject({ width: 22.5, height: 72 });
  });

  it('lays out a Torculus with fitted rising and falling connections', () => {
    const neumeLayout = layoutChant(
      createDocument([torculus('torculus', 2, 5, 3)]),
    ).systems.flatMap((system) => system.neumes)[0];
    const first = neumeLayout?.notes[0];
    const second = neumeLayout?.notes[1];
    const third = neumeLayout?.notes[2];

    if (!neumeLayout || !first || !second || !third) {
      throw new Error('Missing Torculus layout');
    }

    expect(neumeLayout).toMatchObject({
      neumeId: 'neume-torculus',
      kind: 'torculus',
    });
    expect(neumeLayout.notes.map((note) => note.noteId)).toEqual([
      'torculus-first',
      'torculus-second',
      'torculus-third',
    ]);
    expect(second.anchorX - first.anchorX).toBe(10.5);
    expect(third.anchorX - second.anchorX).toBe(10.5);
    expect(neumeLayout.ink).toHaveLength(1);
    expect(neumeLayout.bounds).toMatchObject({ width: 33, height: 48 });
  });

  it('spaces after a complete Torculus and exposes no interior boundary', () => {
    const neumes = [torculus('torculus', 2, 4, 3), punctum('following', 3)];
    const laidOut = layoutChant(createDocument(neumes)).systems.flatMap(
      (system) => system.neumes,
    );
    const torculusNotes = laidOut[0]?.notes;
    const following = laidOut[1]?.notes[0];
    const final = torculusNotes?.[2];

    if (!torculusNotes || !following || !final) {
      throw new Error('Missing Torculus spacing');
    }

    expect(following.x - (final.x + final.width)).toBe(33);
    expect(getNeumeBoundaryCenterX(neumes, 0)).toBe(
      noteCenterX(torculusNotes[0]),
    );
    expect(getNeumeBoundaryCenterX(neumes, 1)).toBe(noteCenterX(following));
  });

  it('places a following neume after the final Scandicus note and exposes no interior boundary', () => {
    const neumes = [scandicus('scandicus', 2, 4, 7), punctum('following', 3)];
    const layout = layoutChant(createDocument(neumes));
    const scandicusNotes = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes;
    const following = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];
    const final = scandicusNotes?.[2];

    if (!scandicusNotes || !following || !final) {
      throw new Error('Missing Scandicus spacing');
    }

    expect(following.x - (final.x + final.width)).toBe(33);
    expect(getNeumeBoundaryCenterX(neumes, 0)).toBe(
      noteCenterX(scandicusNotes[0]),
    );
    expect(getNeumeBoundaryCenterX(neumes, 1)).toBe(noteCenterX(following));
    expect(getNeumeBoundaryCenterX(neumes, 2)).not.toBeNull();
  });

  it('places a following neume after compact Clivis width and the normal gap', () => {
    const layout = layoutChant(
      createDocument([clivis('clivis', 4, 2), punctum('following', 3)]),
    );
    const clivisNotes = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes;
    const following = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];
    const upper = clivisNotes?.[0];
    const lower = clivisNotes?.[1];

    if (!upper || !lower || !following) {
      throw new Error('Missing Clivis layout');
    }

    const normalInterNeumeGap = 33;

    expect(following.x - (lower.x + lower.width)).toBe(normalInterNeumeGap);
    expect(noteCenterX(following) - noteCenterX(upper)).toBeLessThan(96);
  });

  it('aligns a Punctum lyric to its sole note center', () => {
    const layout = layoutChant(createDocument([punctum('punctum', 2)]));
    const note = layout.systems.flatMap((system) => system.neumes)[0]?.notes[0];

    if (!note) {
      throw new Error('Missing Punctum note layout');
    }

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      noteCenterX(note),
    );
  });

  it('uses only the first Punctum for several neumes on one syllable', () => {
    const layout = layoutChant(
      createDocument([
        punctum('note-1', 2),
        punctum('note-2', 3),
        punctum('note-3', 4),
      ]),
    );
    const notes = layout.systems
      .flatMap((system) => system.neumes)
      .flatMap((neume) => neume.notes);
    const lyric = layout.systems.flatMap((system) => system.lyrics)[0];
    const firstNote = notes[0];
    const lastNote = notes[2];

    expect(layout.systems.flatMap((system) => system.lyrics)).toHaveLength(1);
    if (!firstNote || !lastNote) {
      throw new Error('Missing note layout');
    }

    expect(lyric?.x).toBe(noteCenterX(firstNote));
    expect(lyric?.x).not.toBe(noteCenterX(lastNote));
  });

  it('aligns a first Podatus to its first lower note only', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus', 2, 3),
        clivis('following-clivis', 4, 2),
        punctum('following-punctum', 4),
      ]),
    );
    const podatusLayout = layout.systems.flatMap((system) => system.neumes)[0];
    const firstNote = podatusLayout?.notes[0];
    const secondNote = podatusLayout?.notes[1];

    if (!podatusLayout || !firstNote || !secondNote) {
      throw new Error('Missing Podatus layout');
    }

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      firstNote.anchorX,
    );
    // Stacked heads have the same x, but musical ownership stays on the lower note.
    expect(firstNote.anchorY).toBeGreaterThan(secondNote.anchorY);
    expect(podatusLayout.lyricAnchorX).toBe(firstNote.anchorX);
  });

  it('aligns a first Scandicus lyric to its first note only', () => {
    const layout = layoutChant(
      createDocument([scandicus('scandicus', 2, 4, 7), punctum('later', 3)]),
    );
    const neumeLayout = layout.systems.flatMap((system) => system.neumes)[0];
    const first = neumeLayout?.notes[0];
    const middle = neumeLayout?.notes[1];
    const final = neumeLayout?.notes[2];

    if (!neumeLayout || !first || !middle || !final) {
      throw new Error('Missing Scandicus lyric layout');
    }

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      noteCenterX(first),
    );
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(
      noteCenterX(middle),
    );
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(
      noteCenterX(final),
    );
    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).not.toBe(
      neumeLayout.bounds.x + neumeLayout.bounds.width / 2,
    );
  });

  it('aligns a first Torculus lyric to its first note only', () => {
    const layout = layoutChant(
      createDocument([torculus('torculus', 2, 5, 3), punctum('later', 3)]),
    );
    const neumeLayout = layout.systems.flatMap((system) => system.neumes)[0];
    const [first, second, third] = neumeLayout?.notes ?? [];
    const lyricX = layout.systems.flatMap((system) => system.lyrics)[0]?.x;

    if (!neumeLayout || !first || !second || !third) {
      throw new Error('Missing Torculus lyric layout');
    }

    expect(lyricX).toBe(noteCenterX(first));
    expect(lyricX).not.toBe(noteCenterX(second));
    expect(lyricX).not.toBe(noteCenterX(third));
    expect(lyricX).not.toBe(
      neumeLayout.bounds.x + neumeLayout.bounds.width / 2,
    );
  });

  it('aligns a first Clivis to its complete raw bounds center', () => {
    const layout = layoutChant(
      createDocument([
        clivis('clivis', 4, 3),
        podatus('following-podatus', 2, 4),
        punctum('following-punctum', 2),
      ]),
    );
    const clivisLayout = layout.systems.flatMap((system) => system.neumes)[0];
    const firstNote = clivisLayout?.notes[0];
    const secondNote = clivisLayout?.notes[1];

    if (!clivisLayout || !firstNote || !secondNote) {
      throw new Error('Missing Clivis layout');
    }

    const boundsCenter = clivisLayout.bounds.x + clivisLayout.bounds.width / 2;
    const noteMidpoint = (noteCenterX(firstNote) + noteCenterX(secondNote)) / 2;

    expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
      boundsCenter,
    );
    expect(boundsCenter).toBe(noteMidpoint);
  });

  it('does not move a lyric when a later neume is appended, moved vertically, or deleted', () => {
    const initial = createDocument([
      punctum('first', 2),
      podatus('later', 3, 5),
    ]);
    const appended = {
      ...initial,
      neumes: [...initial.neumes, clivis('appended', 5, 3)],
    };
    const moved = moveNeumeVertically(appended, 'neume-later', 1);
    const deleted = deleteNeume(moved, 'neume-appended');
    const lyricXs = [initial, appended, moved, deleted].map(
      (document) =>
        layoutChant(document).systems.flatMap((system) => system.lyrics)[0]?.x,
    );

    expect(new Set(lyricXs).size).toBe(1);
  });

  it('derives insertion anchors again through undo and redo', () => {
    const initial = createDocument([
      podatus('old-first', 2, 4),
      punctum('later', 3),
    ]);
    const initialAnchor = layoutChant(initial).systems.flatMap(
      (system) => system.lyrics,
    )[0]?.x;
    const insertedHistory = applyDocumentEdit(
      createDocumentHistory(initial),
      (document) => insertClivis(document, clivis('new-first', 5, 3), 0),
    );
    const insertedAnchor = layoutChant(insertedHistory.present).systems.flatMap(
      (system) => system.lyrics,
    )[0]?.x;
    const undone = undoDocumentEdit(insertedHistory);
    const redone = redoDocumentEdit(undone);

    expect(insertedAnchor).not.toBe(initialAnchor);
    expect(
      layoutChant(undone.present).systems.flatMap((system) => system.lyrics)[0]
        ?.x,
    ).toBe(initialAnchor);
    expect(
      layoutChant(redone.present).systems.flatMap((system) => system.lyrics)[0]
        ?.x,
    ).toBe(insertedAnchor);
  });

  it.each([
    {
      kind: 'Podatus',
      neume: podatus('first', 2, 4),
      deletedNoteId: 'first-lower',
      survivingNoteId: 'first-upper',
    },
    {
      kind: 'Podatus',
      neume: podatus('first', 2, 4),
      deletedNoteId: 'first-upper',
      survivingNoteId: 'first-lower',
    },
    {
      kind: 'Clivis',
      neume: clivis('first', 5, 3),
      deletedNoteId: 'first-upper',
      survivingNoteId: 'first-lower',
    },
    {
      kind: 'Clivis',
      neume: clivis('first', 5, 3),
      deletedNoteId: 'first-lower',
      survivingNoteId: 'first-upper',
    },
  ])(
    'aligns normalized first $kind to surviving $survivingNoteId',
    ({ neume, deletedNoteId, survivingNoteId }) => {
      const normalized = deleteNote(
        createDocument([neume, punctum('later', 4)]),
        deletedNoteId,
      );
      const layout = layoutChant(normalized);
      const firstNeume = layout.systems.flatMap((system) => system.neumes)[0];
      const survivor = firstNeume?.notes[0];

      if (!survivor) {
        throw new Error('Missing normalized survivor layout');
      }

      expect(firstNeume?.kind).toBe('punctum');
      expect(survivor.noteId).toBe(survivingNoteId);
      expect(layout.systems.flatMap((system) => system.lyrics)[0]?.x).toBe(
        noteCenterX(survivor),
      );
    },
  );

  it('removes the lyric and syllable after removing its anchor', () => {
    const document = createDocument([punctum('only', 2)]);
    const deleted = deleteNeume(document, 'neume-only');

    expect(
      layoutChant(deleted).systems.flatMap((system) => system.lyrics),
    ).toEqual([]);
    expect(deleted.syllables).toEqual([]);
  });

  it('preserves ordinary spacing between separate puncta', () => {
    const layout = layoutChant(
      createDocument([punctum('first', 2), punctum('second', 3)]),
    );
    const first = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes[0];
    const second = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];

    if (!first || !second) {
      throw new Error('Missing punctum layout');
    }

    expect(noteCenterX(second) - noteCenterX(first)).toBe(45);
  });

  it('preserves nested Podatus neume and note identities', () => {
    const layout = layoutChant(createDocument([podatus('stable', 2, 3)]));

    expect(layout.systems.flatMap((system) => system.neumes)[0]).toMatchObject({
      neumeId: 'neume-stable',

      kind: 'podatus',
    });
    expect(
      layout.systems
        .flatMap((system) => system.neumes)[0]
        ?.notes.map((note) => note.noteId),
    ).toEqual(['stable-lower', 'stable-upper']);
  });

  it('wraps a long document without a semantic capacity limit', () => {
    const atCapacity = layoutChant(
      createDocument(
        Array.from({ length: 10 }, (_, index) => punctum(`note-${index}`, 3)),
      ),
    );
    const overflow = layoutChant(
      createDocument(
        Array.from({ length: 11 }, (_, index) => punctum(`note-${index}`, 3)),
      ),
    );
    const staffEndX = atCapacity.systems[0]?.staffLines[0]?.x2;
    const finalAtCapacity = atCapacity.systems[0]?.neumes.at(-1)?.notes[0];
    const finalOverflow = overflow.systems[1]?.neumes[0]?.notes[0];

    expect(atCapacity.systems).toHaveLength(1);
    expect(overflow.systems).toHaveLength(2);
    expect(
      finalAtCapacity && staffEndX !== undefined
        ? finalAtCapacity.x + finalAtCapacity.width
        : undefined,
    ).toBeLessThanOrEqual(staffEndX ?? 0);
    expect(
      finalOverflow && staffEndX !== undefined
        ? finalOverflow.x + finalOverflow.width
        : undefined,
    ).toBeLessThanOrEqual(staffEndX ?? 0);
  });

  it.each([
    { neume: punctum('punctum-bounds', 3), kind: 'punctum' },
    { neume: podatus('podatus-bounds', 2, 4), kind: 'podatus' },
    { neume: clivis('clivis-bounds', 5, 3), kind: 'clivis' },
    {
      neume: scandicus('scandicus-bounds', 2, 4, 7),
      kind: 'scandicus',
    },
    {
      neume: torculus('torculus-bounds', 2, 5, 3),
      kind: 'torculus',
    },
  ])('$kind bounds contain every constituent note', ({ neume }) => {
    const neumeLayout = layoutChant(createDocument([neume])).systems.flatMap(
      (system) => system.neumes,
    )[0];

    if (!neumeLayout) {
      throw new Error('Missing neume layout');
    }

    for (const note of neumeLayout.notes) {
      expect(neumeLayout.bounds.x).toBeLessThanOrEqual(note.x);
      expect(neumeLayout.bounds.y).toBeLessThanOrEqual(note.y);
      expect(
        neumeLayout.bounds.x + neumeLayout.bounds.width,
      ).toBeGreaterThanOrEqual(note.x + note.width);
      expect(
        neumeLayout.bounds.y + neumeLayout.bounds.height,
      ).toBeGreaterThanOrEqual(note.y + note.height);
    }
  });

  it.each([
    podatus('podatus-connector-bounds', 2, 6),
    clivis('clivis-connector-bounds', 6, 2),
    scandicus('scandicus-connector-bounds', 1, 4, 7),
    torculus('torculus-connector-bounds', 1, 5, 3),
  ])('includes the $kind connector painted extent in bounds', (neume) => {
    const neumeLayout = layoutChant(createDocument([neume])).systems.flatMap(
      (system) => system.neumes,
    )[0];

    if (!neumeLayout || neumeLayout.ink.length === 0) {
      throw new Error('Missing connector layout');
    }

    for (const { bounds } of neumeLayout.ink) {
      expect(neumeLayout.bounds.x).toBeLessThanOrEqual(bounds.x);
      expect(neumeLayout.bounds.y).toBeLessThanOrEqual(bounds.y);
      expect(
        neumeLayout.bounds.x + neumeLayout.bounds.width,
      ).toBeGreaterThanOrEqual(bounds.x + bounds.width);
      expect(
        neumeLayout.bounds.y + neumeLayout.bounds.height,
      ).toBeGreaterThanOrEqual(bounds.y + bounds.height);
    }
  });

  it('keeps score dimensions and first-Pes anchor with the approved stacked geometry', () => {
    const layout = layoutChant(
      createDocument([
        podatus('podatus-invariant', 2, 4),
        punctum('punctum-invariant', 3),
      ]),
    );
    const firstNotes = layout.systems.flatMap((system) => system.neumes)[0]
      ?.notes;
    const following = layout.systems.flatMap((system) => system.neumes)[1]
      ?.notes[0];

    if (!firstNotes || !following) {
      throw new Error('Missing invariant layout');
    }

    expect(layout.width).toBe(720);
    expect(layout.height).toBe(220);
    expect(firstNotes.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 224, y: 94 },
      { x: 224, y: 70 },
    ]);
    expect(following.x).toBe(269);
    expect(layout.systems.flatMap((system) => system.lyrics)[0]).toMatchObject({
      x: 230,
      y: 180,
      fontSize: 20,
    });
  });

  it('adds geometry only without inventing IDs or selection state', () => {
    const neumeLayout = layoutChant(
      createDocument([podatus('identity-bounds', 2, 4)]),
    ).systems.flatMap((system) => system.neumes)[0];

    expect(neumeLayout).toMatchObject({
      neumeId: 'neume-identity-bounds',
      kind: 'podatus',
      notes: [
        { noteId: 'identity-bounds-lower' },
        { noteId: 'identity-bounds-upper' },
      ],
    });
    expect(Object.keys(neumeLayout?.bounds ?? {})).toEqual([
      'x',
      'y',
      'width',
      'height',
    ]);
    expect(neumeLayout).not.toHaveProperty('selection');
    expect(neumeLayout).not.toHaveProperty('selected');
  });
});
