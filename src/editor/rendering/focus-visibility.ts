import { scoreViewportTop } from './sticky-visibility';
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

/** Usable bounds of a container (or the page, below the sticky toolbar). */
function usableViewport(
  target: Element,
  container: HTMLElement | undefined,
  margin: number,
): VisibleBounds {
  const rect = container?.getBoundingClientRect();
  // Client metrics are in the container's own CSS pixels; under CSS `zoom`
  // they differ from its client rect. Convert them with the measured factor
  // (exactly 1 without zoom).
  const scaleX =
    rect && container?.offsetWidth ? rect.width / container.offsetWidth : 1;
  const scaleY =
    rect && container?.offsetHeight ? rect.height / container.offsetHeight : 1;
  const top = rect ? rect.top + (container?.clientTop ?? 0) * scaleY : 0;
  const left = rect ? rect.left + (container?.clientLeft ?? 0) * scaleX : 0;
  const bottom = container
    ? top + container.clientHeight * scaleY
    : window.innerHeight;
  const right = container
    ? left + container.clientWidth * scaleX
    : document.documentElement.clientWidth;
  return {
    left: left + margin,
    right: right - margin,
    top: (container ? top : scoreViewportTop(target, top)) + margin,
    bottom: bottom - margin,
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
    usableViewport(target, container, 8),
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
    if (delta.x || delta.y)
      (container ?? window).scrollBy({
        left: delta.x,
        top: delta.y,
        behavior: 'instant',
      });
  };
  scrollContainers(target).forEach((container) => reveal(container));
  reveal();
}

/**
 * Whether any part of the target is visible: inside every scroll container
 * and the page's usable area below the sticky toolbar.
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
