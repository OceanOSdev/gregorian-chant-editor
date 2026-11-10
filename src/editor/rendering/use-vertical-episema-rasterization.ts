import { useLayoutEffect, useRef, type RefObject } from 'react';
import { verticalEpisemaScreenShift } from './vertical-episema-rasterization';

const selector = '.score__vertical-episema';
const property = '--vertical-episema-shift';

function clear(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGRectElement>(selector).forEach((tick) => {
    tick.style.removeProperty(property);
  });
}

function align(svg: SVGSVGElement) {
  const rootMatrix = svg.getScreenCTM();
  if (!rootMatrix || window.matchMedia('print').matches) return;
  const viewBox = svg.viewBox.baseVal;
  const canvasLeft = new DOMPoint(viewBox.x, viewBox.y).matrixTransform(
    rootMatrix,
  ).x;
  const canvasRight = new DOMPoint(
    viewBox.x + viewBox.width,
    viewBox.y,
  ).matrixTransform(rootMatrix).x;
  const viewport = svg.closest('.score-viewport');
  const clip = viewport?.getBoundingClientRect();
  const viewportLeft = clip
    ? clip.left + (viewport?.clientLeft ?? 0)
    : canvasLeft;
  const viewportRight = viewport
    ? viewportLeft + viewport.clientWidth
    : canvasRight;
  const visual = window.visualViewport;
  const clipLeft = Math.max(canvasLeft, viewportLeft);
  const clipRight = Math.min(canvasRight, viewportRight);
  // Read the parent's matrix: the tick's own CSS alignment must not accumulate.
  const shifts = [...svg.querySelectorAll<SVGRectElement>(selector)].map(
    (tick) => {
      const parent = tick.parentElement;
      const matrix =
        parent instanceof SVGGraphicsElement ? parent.getScreenCTM() : null;
      if (!matrix || matrix.b !== 0 || matrix.c !== 0 || matrix.a <= 0)
        return { tick, shift: 0 };
      const left = new DOMPoint(
        tick.x.baseVal.value,
        tick.y.baseVal.value,
      ).matrixTransform(matrix).x;
      const shift = verticalEpisemaScreenShift({
        left,
        width: tick.width.baseVal.value * matrix.a,
        unitsToCss: matrix.a,
        devicePixelRatio: window.devicePixelRatio,
        visualScale: visual?.scale ?? 1,
        visualOffsetX: visual?.offsetLeft ?? 0,
        clipLeft,
        clipRight,
      });
      return { tick, shift };
    },
  );
  for (const { tick, shift } of shifts)
    tick.style.setProperty(property, `${shift}px`);
}

/** Screen-only hinting, shared by committed ink and the same SVG's preview. */
export function useVerticalEpisemaRasterization(
  score: RefObject<SVGSVGElement | null>,
) {
  const printing = useRef(false);
  // Every React commit can replace ink (layout, fonts, history or cursor ghost).
  useLayoutEffect(() => {
    if (score.current && !printing.current) align(score.current);
  });
  useLayoutEffect(() => {
    const svg = score.current;
    if (!svg) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!printing.current) align(svg);
      });
    };
    const beforePrint = () => {
      printing.current = true;
      clear(svg);
    };
    const afterPrint = () => {
      printing.current = false;
      schedule();
    };
    const media = window.matchMedia('print');
    const mediaChanged = () => (media.matches ? beforePrint() : afterPrint());
    let density = window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    const densityChanged = () => {
      density.removeEventListener('change', densityChanged);
      density = window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      density.addEventListener('change', densityChanged);
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(svg);
    document.addEventListener('scroll', schedule, true);
    document.fonts.addEventListener('loadingdone', schedule);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    media.addEventListener('change', mediaChanged);
    density.addEventListener('change', densityChanged);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener('scroll', schedule, true);
      document.fonts.removeEventListener('loadingdone', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      media.removeEventListener('change', mediaChanged);
      density.removeEventListener('change', densityChanged);
      clear(svg);
    };
  }, [score]);
}
