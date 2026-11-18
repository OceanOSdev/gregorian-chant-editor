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

/**
 * Raise the usable bottom above a floating box only where it actually covers
 * the target: when their columns overlap and the box reaches above the
 * bottom. A target beside the box keeps the full height.
 */
export function unobstructedViewportBottom(
  box: VisibleBounds | null,
  target: Pick<VisibleBounds, 'left' | 'right'>,
  bottom: number,
): number {
  return box &&
    box.left < target.right &&
    box.right > target.left &&
    box.top < bottom &&
    box.bottom > box.top
    ? Math.min(bottom, box.top)
    : bottom;
}

/**
 * The page's usable bottom for revealing `target`: playback controls pinned
 * to the viewport corner (only while the toolbar does not stick) cover the
 * columns below them.
 */
export function scoreViewportBottom(
  target: Element,
  bottom = window.innerHeight,
): number {
  const pinned = target
    .closest('.chant-editor')
    ?.querySelector('.editor-playback--pinned');
  return unobstructedViewportBottom(
    pinned?.getBoundingClientRect() ?? null,
    target.getBoundingClientRect(),
    bottom,
  );
}
