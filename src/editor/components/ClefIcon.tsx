import type { Clef } from '../domain/chant-document';
import { buildClefGeometry } from '../layout/clef-geometry';

export function ClefIcon({ type }: { type: Clef['type'] }) {
  const geometry = buildClefGeometry({ type, staffLine: 2 }, 0, 0);

  const { x, y, width, height } = geometry.bounds;
  const box = Math.max(width, height) + 4;

  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox={`${x + width / 2 - box / 2} ${y + height / 2 - box / 2} ${box} ${box}`}
    >
      <path d={geometry.path} fill="currentColor" />
    </svg>
  );
}
