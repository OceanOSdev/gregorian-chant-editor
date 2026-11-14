import type {
  Neume,
  NoteAppearance,
  StaffPosition,
} from '../../domain/chant-document';
import { allowedNoteForms, isNoteForm } from '../../domain/note-forms';
import { buildPunctum } from './punctum';
import {
  finishGeometry,
  geometryContext,
  headContours,
  note,
  type NeumeGeometry,
} from './shared';

/** Original measured contours; ordinary recipes are deliberately untouched. */
export function buildAuthoredGeometry(
  kind: Neume['kind'],
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
  appearance: readonly NoteAppearance[],
): NeumeGeometry | null {
  const authored = appearance.flatMap((n, index) =>
    'form' in n ? [{ form: n.form, index }] : [],
  );
  if (!authored.length) return null;
  if (
    authored.some(
      ({ form, index }) =>
        !isNoteForm(form) ||
        !allowedNoteForms(kind, index, positions.length).includes(form),
    )
  )
    throw new Error('Unsupported authored note form');
  if (authored.length !== 1)
    throw new Error('Unsupported authored form combination');
  const form = authored[0].form;
  if (!isNoteForm(form)) throw new Error('Unsupported authored note form');
  switch (form) {
    case 'virga':
      if (kind !== 'punctum') throw new Error('Virga requires a one-note unit');
      return buildVirga(positions, leftX, bottomStaffY);
    case 'inclinatum':
      if (kind !== 'punctum')
        throw new Error('Inclinatum requires a one-note unit');
      return buildInclinatum(positions, leftX, bottomStaffY);
    case 'quilisma':
      if (kind !== 'podatus' && kind !== 'scandicus')
        throw new Error('Quilisma requires an ascending figure');
      return buildQuilismaticFigure(kind, positions, leftX, bottomStaffY);
    default: {
      const unhandled: never = form;
      throw new Error(`Unsupported authored note form: ${unhandled}`);
    }
  }
}

function buildVirga(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { x, y, move, shape } = geometryContext(positions, leftX, bottomStaffY);
  // Exact proportions and fitted underside of the approved Climacus virga.
  const virga = shape(
    `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} C${move(9, -6)} ${move(12, -5.4)} ${move(12, -4)} V${y + 27} H${x + 10.5} V${y + 5.9} C${move(9, 5.7)} ${move(8, 4.8)} ${move(6, 4.8)} C${move(4, 4.8)} ${move(2.2, 6)} ${move(0.4, 6)} C${move(0.15, 6)} ${move(0, 5.9)} ${move(0, 5.6)} Z`,
    0,
    -6,
    12,
    33,
  );
  const head = buildPunctum(positions, x, bottomStaffY).notes[0];
  head.hitBounds = { x: x - 6, y: y - 12, width: 24, height: 45 };
  return finishGeometry([head], [virga], x + 6);
}

function buildInclinatum(
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { x, y, move, shape } = geometryContext(positions, leftX, bottomStaffY);
  // Same upright diamond silhouette, with its left ink edge at the input origin.
  // Its true centre anchors the note and lyric; rebuilds need no negative bearing.
  const diamond = shape(
    `M${move(7, -10)} L${move(14, 0)} L${move(7, 10)} L${move(0, 0)} Z`,
    0,
    -10,
    14,
    20,
  );
  return finishGeometry([note(diamond, x + 7, y)], [diamond], x + 7);
}

function buildQuilismaticFigure(
  kind: 'podatus' | 'scandicus',
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const { x, y, move, shape } = geometryContext(positions, leftX, bottomStaffY);
  const middleIndex = kind === 'scandicus' ? 1 : 0;
  const lower = positions[middleIndex],
    upper = positions[middleIndex + 1];
  if (
    lower === undefined ||
    upper === undefined ||
    upper <= lower ||
    (kind === 'scandicus' && lower <= positions[0])
  )
    throw new Error('Quilisma requires ascending pitches');
  const h = kind === 'scandicus' ? 10.5 : 0;
  const u = (positions[0] - lower) * 12;
  const v = (positions[0] - upper) * 12;
  const adjacent = upper - lower === 1;
  const top = v - (adjacent ? 10 : 6);
  const terminalBottom = v + (adjacent ? 4 : 6);
  const terminalReturn = v + (adjacent ? 2 : 4);
  const { crown, underside } = headContours(move, y);
  // One pitched jagged head with three teeth and rounded lower returns.
  const waveTop = `L${move(h + 3, u + 1)} L${move(h + 4, u - 5)} L${move(h + 7, u)} L${move(h + 8, u - 7)} L${move(h + 10.5, u - 3)}`;
  const connectedWaveBottom = `Q${move(h + 11, u + 6)} ${move(h + 9, u + 1)} L${move(h + 8, u + 5)} Q${move(h + 7, u + 7)} ${move(h + 6, u + 7)} Q${move(h + 5, u + 7)} ${move(h + 4, u + 3)} L${move(h + 3, u + 6)} Q${move(h + 2, u + 7)} ${move(h + 1.5, u + 7)}`;
  const waveBottom = `Q${move(h + 11, u + 6)} ${move(h + 9, u + 1)} L${move(h + 8, u + 5)} Q${move(h + 7, u + 7)} ${move(h + 6, u + 7)} Q${move(h + 5, u + 7)} ${move(h + 4, u + 3)} L${move(h + 3, u + 6)} Q${move(h + 2, u + 7)} ${move(h + 1, u + 7)} Q${move(h, u + 6)} ${move(h, u + 4)}`;
  const wave = shape(
    `M${move(h, u - 4)} ${waveTop} L${move(h + 12, u - 3)} V${y + u + 2} ${waveBottom} Z`,
    h,
    u - 7,
    12,
    14,
  );
  const upperCrown = crown(h, top);
  const upperReturn = `V${y + terminalBottom} H${x + h + 10.5} Q${move(h + 8, terminalReturn)} ${move(h, terminalReturn)}`;
  const terminal = shape(
    `${upperCrown} ${upperReturn} Z`,
    h,
    top,
    12,
    terminalBottom - top,
  );
  const pairStart =
    kind === 'scandicus'
      ? `M${move(0, -4)} C${move(0, -5.4)} ${move(3, -6)} ${move(6, -6)} H${x + h} V${y + u - 4}`
      : `M${move(h, u - 4)}`;
  const pairEnd = kind === 'scandicus' ? `${underside(0, 0)} Z` : 'Z';
  // Follow the full outer boundary once, including both rising joins. No
  // overlaid bridge, persisted fusion state, or unmeasured SVG decoration.
  const d = `${pairStart} ${waveTop} V${y + terminalBottom} Q${move(h + 8, terminalReturn)} ${move(h, terminalReturn)} V${y + top + 2} ${upperCrown.replace('M', 'L')} V${y + u + 2} ${kind === 'scandicus' ? connectedWaveBottom : waveBottom} ${pairEnd}`;
  const ink = shape(
    d,
    0,
    top,
    h + 12,
    (kind === 'scandicus' ? Math.max(6, u + 7) : 7) - top,
  );
  const middle = note(wave, x + h + 6, y + u);
  const last = note(terminal, x + h + 6, y + v);
  const notes =
    kind === 'scandicus'
      ? [buildPunctum([positions[0]], x, bottomStaffY).notes[0], middle, last]
      : [middle, last];
  if (kind === 'scandicus') {
    const first = notes[0];
    // Above the lower contact, the upper column belongs to the quilisma.
    // Below it, the first head and its ascending shaft retain their own target.
    const contact = u + 7.5;
    first.hitShape = shape(
      `M${move(-6, u - 10)} H${x + h} V${y + contact} H${x + 18} V${y + 12} H${x - 6} Z`,
      -6,
      u - 10,
      24,
      22 - u,
    );
    first.hitBounds = first.hitShape.bounds;
    for (const n of [middle, last]) {
      const right = n.hitBounds.x + n.hitBounds.width;
      n.hitBounds.x = x + h;
      n.hitBounds.width = right - n.hitBounds.x;
    }
  }
  // Terminal owns the exposed upper shaft, lower head owns the jagged region.
  const split = y + Math.min((u + v) / 2, u - 7.5);
  const bottom =
    kind === 'scandicus'
      ? y + u + 7.5
      : middle.hitBounds.y + middle.hitBounds.height;
  middle.hitBounds.y = split;
  middle.hitBounds.height = bottom - split;
  last.hitBounds.height = split - last.hitBounds.y;
  return finishGeometry(notes, [ink], x + 6);
}
