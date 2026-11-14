import type {
  CompoundDirectionalKind,
  StaffPosition,
} from '../../domain/chant-document';
import { buildClimacus } from './climacus';
import { buildPodatusOrClivis } from './podatus-clivis';
import { buildPorrectus } from './porrectus';
import { buildPunctum } from './punctum';
import {
  engravingStaffStep,
  finishGeometry,
  geometryContext,
  headContours,
  note,
  type InkShape,
  type LayoutBounds,
  type NeumeGeometry,
  type NoteGeometry,
} from './shared';

/** Width of one square head; elements in successive columns abut. */
const headWidth = 12;
/** Optical gap before the detached Climacus resupinus Punctum (Liber p. 361). */
const resupinusGap = 6;

function pitches(
  positions: readonly StaffPosition[],
): [StaffPosition, StaffPosition, StaffPosition, StaffPosition] {
  const [a, b, c, d] = positions;
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    positions.length !== 4
  )
    throw new Error('A compound directional neume has four pitches');
  return [a, b, c, d];
}

/** Restricts a rectangular pointer target to one horizontal ownership band. */
function clipTarget(
  geometry: NoteGeometry,
  left: number,
  right: number,
): NoteGeometry {
  const target = geometry.hitBounds;
  const x = Math.max(target.x, left);
  const hitBounds: LayoutBounds = {
    ...target,
    x,
    width: Math.min(target.x + target.width, right) - x,
  };
  return { ...geometry, hitBounds };
}

/**
 * Deterministic Roman/Solesmes profiles approved at Gate A (ADR 0025). The
 * three-note recipes are reused unchanged; only the two porrectus joins are
 * new derived geometry.
 */
export function buildCompoundDirectional(
  kind: CompoundDirectionalKind,
  positions: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  switch (kind) {
    case 'torculus-resupinus':
      return buildTorculusResupinus(pitches(positions), leftX, bottomStaffY);
    case 'porrectus-flexus':
      return buildPorrectusFlexus(pitches(positions), leftX, bottomStaffY);
    case 'scandicus-flexus':
      return buildScandicusFlexus(pitches(positions), leftX, bottomStaffY);
    case 'climacus-resupinus':
      return buildClimacusResupinus(pitches(positions), leftX, bottomStaffY);
  }
}

/**
 * Leading Punctum joined at the foot of the Porrectus left stem (Liber
 * p. 1002). The stem runs from the stroke's first pitch down to the
 * Punctum's underside, derived from the actual first rise; the third pitch
 * may lie above, at or below the first without changing the attachment.
 */
function buildTorculusResupinus(
  [first, second, third, fourth]: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const punctum = buildPunctum([first], leftX, bottomStaffY);
  const strokeX = leftX + headWidth;
  const rise = (second - first) * engravingStaffStep;
  const porrectus = buildPorrectus(
    [second, third, fourth],
    strokeX,
    bottomStaffY,
    rise + 6,
  );
  const notes = [
    clipTarget(punctum.notes[0], -Infinity, strokeX),
    ...porrectus.notes.map((geometry, index) =>
      index === 0 ? clipTarget(geometry, strokeX, Infinity) : geometry,
    ),
  ];
  return finishGeometry(
    notes,
    [...punctum.ink, ...porrectus.ink],
    punctum.lyricAnchorX,
  );
}

/**
 * Porrectus whose terminal becomes the head of a Clivis: a right-side stem
 * descends to the fourth note, placed as the approved Clivis second head
 * (abutting for a step, overlapping the stem for a skip).
 */
function buildPorrectusFlexus(
  [first, second, third, fourth]: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const porrectus = buildPorrectus([first, second, third], leftX, bottomStaffY);
  const terminal = porrectus.notes[2];
  if (!terminal) throw new Error('A Porrectus has three constituents');
  const { y, move, shape } = geometryContext([third], 0, bottomStaffY);
  const { underside } = headContours(move, y);
  const termLeft = terminal.head.bounds.x;
  const right = termLeft + headWidth;
  const adjacent = third - fourth === 1;
  const dy = (third - fourth) * engravingStaffStep;
  const secondX = termLeft + (adjacent ? headWidth : headWidth - 1.5);
  const head = shape(
    `M${move(secondX, dy - 6)} H${secondX + 6} C${move(secondX + 9, dy - 6)} ${move(secondX + 12, dy - 5.4)} ${move(secondX + 12, dy - 4)} ${underside(secondX, dy)} H${secondX} Z`,
    secondX,
    dy - 6,
    headWidth,
    headWidth,
  );
  // The join runs from the terminal's centre down into the fourth head; a
  // step stops just past the shared corner, as in the Clivis contact.
  const joinBottom = adjacent ? 7.5 : dy;
  const join: InkShape = {
    kind: 'rect',
    bounds: { x: right - 1.5, y: y, width: 1.5, height: joinBottom },
    radius: 0,
  };
  const fourthNote = clipTarget(
    note(head, secondX + 6, y + dy),
    right,
    Infinity,
  );
  const notes = [
    ...porrectus.notes.map((geometry, index) =>
      index === 0 ? geometry : clipTarget(geometry, -Infinity, right),
    ),
    fourthNote,
  ];
  return finishGeometry(
    notes,
    [...porrectus.ink, join, head],
    porrectus.lyricAnchorX,
  );
}

/** The approved Podatus followed by the approved Clivis in the next column. */
function buildScandicusFlexus(
  [first, second, third, fourth]: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const pes = buildPodatusOrClivis(
    'podatus',
    [first, second],
    leftX,
    bottomStaffY,
  );
  const clivisX = leftX + headWidth;
  const clivis = buildPodatusOrClivis(
    'clivis',
    [third, fourth],
    clivisX,
    bottomStaffY,
  );
  return finishGeometry(
    [
      ...pes.notes.map((geometry) => clipTarget(geometry, -Infinity, clivisX)),
      ...clivis.notes.map((geometry) =>
        clipTarget(geometry, clivisX, Infinity),
      ),
    ],
    [...pes.ink, ...clivis.ink],
    pes.lyricAnchorX,
  );
}

/**
 * The ordinary Climacus (virga and detached diamonds) followed by a detached
 * Punctum at its own pitch, with no connector (Liber pp. xxj, 361).
 */
function buildClimacusResupinus(
  [first, second, third, fourth]: readonly StaffPosition[],
  leftX: number,
  bottomStaffY: number,
): NeumeGeometry {
  const climacus = buildClimacus([first, second, third], leftX, bottomStaffY);
  const last = climacus.notes[2];
  if (!last) throw new Error('A Climacus has three constituents');
  // Diamond ink spans its centre ±7; its padded hit polygon reaches +11.
  const punctumX = last.anchorX + 7 + resupinusGap;
  const punctum = buildPunctum([fourth], punctumX, bottomStaffY);
  return finishGeometry(
    [
      ...climacus.notes,
      clipTarget(punctum.notes[0], last.anchorX + 11, Infinity),
    ],
    [...climacus.ink, ...punctum.ink],
    climacus.lyricAnchorX,
  );
}
