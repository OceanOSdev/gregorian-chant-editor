import { useEffect, useMemo, useState } from 'react';
import { lyricGraphemes } from '../domain/lyric-alignment';
import {
  lyricFontFamily,
  lyricFontSize,
  type MeasureLyricText,
} from '../layout/lyric-text-metrics';

/** SVG uses the same shaping engine, font stack and size as the visible lyrics. */
export function createSvgLyricMeasurer(): MeasureLyricText {
  const cache = new Map<string, ReturnType<MeasureLyricText>>();
  return (value) => {
    if (cache.has(value)) return cache.get(value) ?? null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS(
      svg.namespaceURI,
      'text',
    ) as SVGTextElement;
    svg.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none';
    text.setAttribute('font-family', lyricFontFamily);
    text.setAttribute('font-size', String(lyricFontSize));
    text.textContent = value;
    svg.append(text);
    document.body.append(svg);
    try {
      let units = 0;
      const boundaries = [
        0,
        ...lyricGraphemes(value).map((g) => {
          units += g.length;
          return text.getSubStringLength(0, units);
        }),
      ];
      const width = text.getComputedTextLength();
      boundaries[boundaries.length - 1] = width;
      const ink = text.getBBox();
      // SVG font hinting varies slightly with responsive scale. Enclose the
      // painted bounds with a half-unit precision guard, not a word-space policy.
      const precision = 0.5;
      const result =
        width > 0
          ? {
              width,
              boundaries,
              inkBounds: {
                left: ink.x - precision,
                right: ink.x + ink.width + precision,
              },
            }
          : null;
      cache.set(value, result);
      return result;
    } catch {
      cache.set(value, null);
      return null;
    } finally {
      svg.remove();
    }
  };
}

export function useLyricMeasurement(
  texts: readonly string[],
): MeasureLyricText | undefined {
  const [metrics, setMetrics] = useState<
    ReadonlyMap<string, ReturnType<MeasureLyricText>>
  >(new Map());
  const textKey = JSON.stringify(texts);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      const measure = createSvgLyricMeasurer();
      const values: string[] = JSON.parse(textKey);
      setMetrics(new Map(values.map((text) => [text, measure(text)])));
    };
    const pending = () => {
      if (active) setMetrics(new Map());
    };
    document.fonts.addEventListener('loading', pending);
    void document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', refresh);
      document.fonts.removeEventListener('loading', pending);
    };
  }, [textKey]);
  return useMemo(() => (text: string) => metrics.get(text) ?? null, [metrics]);
}
