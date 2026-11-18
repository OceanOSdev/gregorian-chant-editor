import { scoreViewportBottom, scoreViewportTop } from './sticky-visibility';
export interface VisibleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Prefer the first-note anchor when complete bounds exceed the usable viewport. */
export function getVisibilityAdjustment(
  bounds: VisibleBounds,
  viewport: VisibleBounds,
  anchor: VisibleBounds = bounds,
) {
  function offset(
    start: number,
    end: number,
    min: number,
    max: number,
    anchorStart: number,
    anchorEnd: number,
  ) {
    if (end - start > max - min) {
      start = anchorStart;
      end = anchorEnd;
    }
    return start < min ? start - min : end > max ? end - max : 0;
  }
  return {
    x: offset(
      bounds.left,
      bounds.right,
      viewport.left,
      viewport.right,
      anchor.left,
      anchor.right,
    ),
    y: offset(
      bounds.top,
      bounds.bottom,
      viewport.top,
      viewport.bottom,
      anchor.top,
      anchor.bottom,
    ),
  };
}

function scrollContainers(target: Element): HTMLElement[] {
  const containers: HTMLElement[] = [];
  for (
    let parent = target.parentElement;
    parent && parent !== document.documentElement;
    parent = parent.parentElement
  ) {
    if (
      parent !== document.body &&
      /(auto|scroll)/.test(
        getComputedStyle(parent).overflow +
          getComputedStyle(parent).overflowY +
          getComputedStyle(parent).overflowX,
      )
    )
      containers.push(parent);
  }
  return containers;
}

/**
 * A scroll container's CSS `zoom` factor. Under `zoom` (on it or an ancestor)
 * its client rect is in zoomed viewport pixels, while its client metrics and
 * scroll offsets stay in its own CSS pixels. A rendered size within a pixel
 * of the layout size is sub-pixel rounding of `offsetWidth`/`offsetHeight`,
 * not zoom, and counts as exactly 1.
 */
export function zoomFactor(rendered: number, layout: number): number {
  return layout && Math.abs(rendered - layout) >= 1 ? rendered / layout : 1;
}

function containerZoom(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  return {
    rect,
    x: zoomFactor(rect.width, container.offsetWidth),
    y: zoomFactor(rect.height, container.offsetHeight),
  };
}

/**
 * Usable bounds of a container, or of the page below the sticky toolbar.
 * `avoidPinned` also keeps a revealed target clear of pinned playback
 * controls where they cover its columns.
 */
function usableViewport(
  target: Element,
  container: HTMLElement | undefined,
  margin: number,
  avoidPinned = false,
): VisibleBounds {
  if (!container)
    return {
      left: margin,
      right: document.documentElement.clientWidth - margin,
      top: scoreViewportTop(target, 0) + margin,
      bottom:
        (avoidPinned
          ? scoreViewportBottom(target, window.innerHeight)
          : window.innerHeight) - margin,
    };
  // Convert the container's own CSS-pixel metrics into viewport pixels.
  const { rect, x, y } = containerZoom(container);
  const top = rect.top + container.clientTop * y;
  const left = rect.left + container.clientLeft * x;
  return {
    left: left + margin,
    right: left + container.clientWidth * x - margin,
    top: top + margin,
    bottom: top + container.clientHeight * y - margin,
  };
}

/** The scroll needed in one container (or the page) to show the target. */
function adjustmentIn(
  target: Element,
  anchor: Element,
  container?: HTMLElement,
) {
  return getVisibilityAdjustment(
    target.getBoundingClientRect(),
    usableViewport(target, container, 8, true),
    anchor.getBoundingClientRect(),
  );
}

/**
 * Reveal only a clipped target, container by container, by the smallest
 * scroll; the page's usable top excludes the sticky toolbar. Never focuses.
 */
export function revealElement(target: Element, anchor: Element = target) {
  const reveal = (container?: HTMLElement) => {
    const delta = adjustmentIn(target, anchor, container);
    if (!delta.x && !delta.y) return;
    // The delta is in viewport pixels; a zoomed container scrolls in its own.
    const zoom = container ? containerZoom(container) : { x: 1, y: 1 };
    (container ?? window).scrollBy({
      left: delta.x / zoom.x,
      top: delta.y / zoom.y,
      behavior: 'instant',
    });
  };
  scrollContainers(target).forEach((container) => reveal(container));
  reveal();
}

/**
 * Whether any part of the target is visible: inside every scroll container
 * and the page's usable area below the sticky toolbar. Pinned playback
 * controls are not subtracted: they can appear over an already revealed
 * note, which the reader has not scrolled away from.
 */
export function isElementOnScreen(target: Element): boolean {
  const r = target.getBoundingClientRect();
  return [...scrollContainers(target), undefined].every((container) => {
    const v = usableViewport(target, container, 0);
    return (
      r.bottom > v.top &&
      r.top < v.bottom &&
      r.right > v.left &&
      r.left < v.right
    );
  });
}

/** Focus never scrolls implicitly; reveal only a clipped target, container by container. */
export function focusAndReveal(
  element: HTMLElement | SVGElement,
  target: Element = element,
  anchor: Element = target,
) {
  if (document.activeElement !== element)
    element.focus({ preventScroll: true });
  revealElement(target, anchor);
}
