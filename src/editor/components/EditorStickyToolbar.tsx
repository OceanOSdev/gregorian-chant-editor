import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Keeps the notation tools and editor actions in view while scrolling.
 *
 * Marks itself `data-too-tall` when it would cover more than half the viewport
 * (narrow windows, zoom, long labels); the stylesheet then stops it sticking so
 * the score stays reachable.
 */
export function EditorStickyToolbar({ children }: { children: ReactNode }) {
  const toolbar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const update = () => {
      element.dataset.tooTall = String(
        element.getBoundingClientRect().height > window.innerHeight / 2,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div className="editor-sticky-toolbar" ref={toolbar}>
      {children}
    </div>
  );
}
