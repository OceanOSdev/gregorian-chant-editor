import { staffPosition } from '../domain/chant-document';
import type { GraphicalNeumeKind } from '../layout/layout-chant';
import { buildNeumeGeometry } from '../layout/neume-geometry';
import { NeumeInk } from '../rendering/NeumeInk';

const pitches = {
  punctum: [2],
  podatus: [1, 3],
  clivis: [3, 1],
  scandicus: [0, 1, 2],
  torculus: [1, 3, 1],
  climacus: [4, 2, 0],
  porrectus: [3, 1, 3],
};
export function NeumePreview({ kind }: { kind: GraphicalNeumeKind }) {
  const geometry = buildNeumeGeometry(
    kind,
    pitches[kind].map(staffPosition),
    0,
    42,
  );
  const b = geometry.bounds;
  return (
    <svg
      className="neume-preview"
      viewBox={`${b.x - 8} ${b.y - 5} ${b.width + 16} ${b.height + 10}`}
      aria-hidden="true"
    >
      <NeumeInk ink={geometry.ink} />
    </svg>
  );
}
