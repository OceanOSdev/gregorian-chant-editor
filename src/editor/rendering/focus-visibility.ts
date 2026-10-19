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

/** Focus never scrolls implicitly; reveal only a clipped target, container by container. */
export function focusAndReveal(
  element: HTMLElement | SVGElement,
  target: Element = element,
  anchor: Element = target,
) {
  if (document.activeElement !== element)
    element.focus({ preventScroll: true });
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
  function reveal(container?: HTMLElement) {
    const rect = container?.getBoundingClientRect();
    const top = rect ? rect.top + (container?.clientTop ?? 0) : 0;
    const left = rect ? rect.left + (container?.clientLeft ?? 0) : 0;
    const bottom = top + (container?.clientHeight ?? window.innerHeight);
    const right =
      left + (container?.clientWidth ?? document.documentElement.clientWidth);
    const delta = getVisibilityAdjustment(
      target.getBoundingClientRect(),
      {
        left: left + 8,
        right: right - 8,
        top: top + 8,
        bottom: bottom - 8,
      },
      anchor.getBoundingClientRect(),
    );
    if (delta.x || delta.y)
      (container ?? window).scrollBy({
        left: delta.x,
        top: delta.y,
        behavior: 'instant',
      });
  }
  containers.forEach((container) => reveal(container));
  reveal();
}
