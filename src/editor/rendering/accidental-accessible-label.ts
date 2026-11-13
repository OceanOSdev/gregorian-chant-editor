import type { AccidentalLayout } from '../layout/layout-chant';

export function getAccidentalAccessibleLabel(sign: AccidentalLayout): string {
  const { owner, placement } = sign;
  return `Written B-${sign.kind}, owned by note ${owner.noteIndex + 1} of ${owner.neumeKind} ${owner.neumeIndex + 1}${placement ? `, above note ${placement.noteIndex + 1} of ${placement.neumeKind} ${placement.neumeIndex + 1}` : ', before owning neume'}`;
}
