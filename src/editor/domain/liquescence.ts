import type {
  ClivisLiquescence,
  Neume,
  PodatusLiquescence,
} from './chant-document';

/**
 * Accepted ADR 0027 profile: the exact authored liquescent appearances per
 * kind. Every other kind has none. This one table drives validation, decoding,
 * controls and insertion, so no caller re-derives the combinations.
 */
export const liquescenceChoices = {
  podatus: ['diminutive', 'augmentative-descending'],
  clivis: ['diminutive'],
} as const satisfies {
  podatus: readonly PodatusLiquescence[];
  clivis: readonly ClivisLiquescence[];
};

export type LiquescentKind = keyof typeof liquescenceChoices;
export type NeumeLiquescence = PodatusLiquescence | ClivisLiquescence;

/** Derived engraving/label identity; never persisted. */
export type LiquescentFigure = 'epiphonus' | 'cephalicus' | 'augmentative-pes';

export const liquescentFigureLabels = {
  epiphonus: 'Epiphonus',
  cephalicus: 'Cephalicus',
  'augmentative-pes': 'Augmentative pes (Dominican)',
} as const satisfies Record<LiquescentFigure, string>;

/** Inline lowercase names for labels and announcements. */
export const liquescentFigureNames = {
  epiphonus: 'epiphonus',
  cephalicus: 'cephalicus',
  'augmentative-pes': 'augmentative pes (Dominican)',
} as const satisfies Record<LiquescentFigure, string>;

export function isLiquescentKind(kind: Neume['kind']): kind is LiquescentKind {
  return kind === 'podatus' || kind === 'clivis';
}

export function allowedLiquescences(
  kind: Neume['kind'],
): readonly NeumeLiquescence[] {
  return isLiquescentKind(kind) ? liquescenceChoices[kind] : [];
}

/** Exact runtime membership: rejects undefined, null, 'none' and unknown text. */
export function isLiquescenceFor(kind: Neume['kind'], value: unknown): boolean {
  return allowedLiquescences(kind).some((choice) => choice === value);
}

/** The authored value, or undefined for ordinary and for every other kind. */
export function neumeLiquescence(neume: Neume): NeumeLiquescence | undefined {
  return neume.kind === 'podatus' || neume.kind === 'clivis'
    ? neume.liquescence
    : undefined;
}

export function liquescentFigureFor(
  kind: Neume['kind'],
  liquescence: NeumeLiquescence | undefined,
): LiquescentFigure | null {
  if (kind === 'podatus' && liquescence === 'diminutive') return 'epiphonus';
  if (kind === 'podatus' && liquescence === 'augmentative-descending')
    return 'augmentative-pes';
  if (kind === 'clivis' && liquescence === 'diminutive') return 'cephalicus';
  return null;
}

export function liquescentFigure(neume: Neume): LiquescentFigure | null {
  return liquescentFigureFor(neume.kind, neumeLiquescence(neume));
}

/**
 * Field presence, kind/value pairing and the D7/D8 product deferrals: no
 * quilisma on the first note and no horizontal or vertical episema on the
 * liquescent second note. Second-note mora is excluded by the liquescent mora
 * matrix (`moraChoices`), the single site for mora scope. These are product
 * limits, not historical prohibitions.
 */
export function hasValidLiquescence(neume: Neume): boolean {
  if (!Object.hasOwn(neume, 'liquescence')) return true;
  const value: unknown = (neume as { liquescence?: unknown }).liquescence;
  if (!isLiquescenceFor(neume.kind, value)) return false;
  const [first, second] = neume.notes;
  if (!first || !second || neume.notes.length !== 2) return false;
  return (
    !Object.hasOwn(first, 'form') &&
    !Object.hasOwn(second, 'episema') &&
    !Object.hasOwn(second, 'verticalEpisema')
  );
}

/** Exactly why a candidate appearance is rejected, or null when it is valid. */
export function liquescenceRejection(
  neume: Neume,
  liquescence: NeumeLiquescence | undefined,
): string | null {
  if (liquescence === undefined) return null;
  const figure = liquescentFigureFor(neume.kind, liquescence);
  if (!figure) return 'Edit rejected: this neume has no such appearance.';
  const name = articled(liquescentFigureNames[figure]);
  const [first, second] = neume.notes;
  if (first?.form)
    return `Edit rejected: a quilismatic pes cannot also be ${name} in this version. Change the first note's Form to default first.`;
  if (second && (second.mora || second.episema || second.verticalEpisema))
    return `Edit rejected: the second note of ${name} cannot carry a mora or episema in this version. Remove marks from the second note first.`;
  return null;
}

/** Why a note-level mark or form is unavailable on this liquescent figure. */
export function liquescentNoteRestriction(
  neume: Neume,
  noteIndex: number,
): string | null {
  const figure = liquescentFigure(neume);
  if (!figure) return null;
  const name = articled(liquescentFigureNames[figure]);
  if (noteIndex === 1)
    return `The second note of ${name} cannot carry a mora or episema in this version. Make the neume ordinary to add one.`;
  return neume.kind === 'podatus'
    ? `The first note of ${name} keeps its marks but cannot be a quilisma in this version.`
    : null;
}

function articled(name: string) {
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
}
