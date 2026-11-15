import type { VisibleBounds } from './focus-visibility';

/** Reserve visible toolbar space, including before it reaches its sticky edge. */
export function occupiedViewportTop(
  bounds: VisibleBounds | null,
  top: number,
  bottom: number,
): number {
  return bounds && bounds.bottom > top && bounds.top < bottom
    ? Math.max(top, bounds.bottom)
    : top;
}

/** Measured browser chrome, kept outside semantic and engraving state. */
export function scoreViewportTop(target: Element, top = 0): number {
  if (target.closest('.editor-sticky-toolbar')) return top;
  const toolbar = target
    .closest('.chant-editor')
    ?.querySelector('.editor-sticky-toolbar');
  return occupiedViewportTop(
    toolbar?.getBoundingClientRect() ?? null,
    top,
    window.innerHeight,
  );
}
