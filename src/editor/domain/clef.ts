import type { Clef } from './chant-document';

export function isValidClef(value: unknown): value is Clef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'c' || value.type === 'f') &&
    'staffLine' in value &&
    (value.staffLine === 1 ||
      value.staffLine === 2 ||
      value.staffLine === 3 ||
      value.staffLine === 4)
  );
}

const clefSyllable = { c: 'do', f: 'fa' } satisfies Record<
  Clef['type'],
  string
>;

export function clefName({ type }: Clef): string {
  return `${type.toUpperCase()} (${clefSyllable[type]})`;
}
