import type { DivisionKind } from '../domain/chant-document';
import { buildDivisionGeometry } from '../layout/division-geometry';

export function DivisionIcon({ kind }: { kind: DivisionKind }) {
  const geometry = buildDivisionGeometry(
    { id: 'icon', kind, beforeNeumeId: null },
    9,
    20,
    5,
  );
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 24">
      {geometry.lines.map((line, index) => (
        <line key={index} {...line} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
