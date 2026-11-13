import type { Neume } from './chant-document';

export type MoraScope =
  'none' | 'sole' | 'first' | 'second' | 'both' | 'final' | 'final-two';
export interface MoraChoice {
  value: MoraScope;
  label: string;
}

/** The supported notation profile, shared by controls, commands and decoding. */
export function moraChoices(kind: Neume['kind']): readonly MoraChoice[] {
  const none: MoraChoice = { value: 'none', label: 'None' };
  switch (kind) {
    case 'bistropha':
    case 'tristropha':
      return [none];
    // Provisional Stage 9B-1 gate: none-only until the owner approves a
    // sourced matrix (see docs/verification/pes-subpunctis/README.md).
    case 'pes-subpunctis':
      return [none];
    case 'punctum':
      return [none, { value: 'sole', label: 'Sole note' }];
    case 'podatus':
    case 'clivis':
      return [
        none,
        { value: 'first', label: 'First note' },
        { value: 'second', label: 'Second note' },
        { value: 'both', label: 'Both notes' },
      ];
    case 'scandicus':
    case 'torculus':
    case 'climacus':
    case 'porrectus':
      return [
        none,
        { value: 'final', label: 'Final note' },
        { value: 'final-two', label: 'Final two notes' },
      ];
  }
}
/**
 * Affected note indexes for a scope on a tuple of `length` notes. Final scopes
 * are derived from the actual length, so three-note kinds keep [2] and [1, 2].
 */
export function moraIndexes(
  scope: MoraScope,
  length: number,
): readonly number[] {
  if (scope === 'none') return [];
  if (scope === 'sole' || scope === 'first') return [0];
  if (scope === 'second') return [1];
  if (scope === 'both') return [0, 1];
  return scope === 'final' ? [length - 1] : [length - 2, length - 1];
}
/** Resolve only the supported affected-note sets; counts are never coerced. */
export function resolveMoraScope(
  kind: Neume['kind'],
  values: readonly unknown[],
): MoraScope | null {
  if (values.some((value) => value !== undefined && value !== 1)) return null;
  const marked = values.flatMap((value, index) => (value === 1 ? [index] : []));
  return (
    moraChoices(kind).find((choice) => {
      const indexes = moraIndexes(choice.value, values.length);
      return (
        indexes.length === marked.length &&
        indexes.every((value, index) => value === marked[index])
      );
    })?.value ?? null
  );
}
export function getMoraScope(neume: Neume): MoraScope | null {
  if (neume.notes.some((note) => 'mora' in note && note.mora !== 1))
    return null;
  return resolveMoraScope(
    neume.kind,
    neume.notes.map((note) => note.mora),
  );
}
