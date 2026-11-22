import type { Clef } from '../domain/chant-document';
import { buildClefGeometry } from '../layout/clef-geometry';
import { fittedIconSize, inkWidthIconBox } from './icon-view-box';

export function ClefIcon({ type }: { type: Clef['type'] }) {
  const geometry = buildClefGeometry({ type, staffLine: 2 }, 0, 0);

  return (
    <svg
      aria-hidden="true"
      {...inkWidthIconBox(geometry.bounds, fittedIconSize(geometry.bounds))}
    >
      <path d={geometry.path} fill="currentColor" />
    </svg>
  );
}
