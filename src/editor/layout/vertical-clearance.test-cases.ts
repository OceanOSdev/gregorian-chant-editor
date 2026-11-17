import type { ChantLayout, ChantSystemLayout } from './layout-chant';
import {
  lyricDescent,
  lyricRowTop,
  systemGap,
  systemHeight,
  systemMusicPadding,
} from './system-vertical-layout';

/**
 * Test-only Stage 11B invariants (ADR 0028), returned as readable violations
 * so a failing assertion names every offending element.
 */
export function verticalLayoutViolations(layout: ChantLayout): string[] {
  const violations: string[] = [];
  let expectedY = layout.systems[0]?.y ?? 0;
  for (const system of layout.systems) {
    const label = `system ${system.index}`;
    if (system.y !== expectedY)
      violations.push(`${label} y ${system.y} expected ${expectedY}`);
    expectedY = system.y + system.height + systemGap;
    if (system.height < systemHeight)
      violations.push(`${label} height ${system.height} below minimum`);
    violations.push(...systemViolations(system));
  }
  const last = layout.systems.at(-1);
  if (last && layout.y + layout.height < last.y + last.height)
    violations.push('canvas ends before the last system');
  return violations;
}

/** Complete clamped music, shared lyric row and system box containment. */
export function systemViolations(system: ChantSystemLayout): string[] {
  const label = `system ${system.index}`;
  const violations: string[] = [];
  const band = system.musicBand;
  const ink = [
    ...system.neumes.map((n) => ({ id: n.neumeId, bounds: n.bounds })),
    ...system.custodes.map((c, i) => ({ id: `custos ${i}`, bounds: c.bounds })),
    ...system.divisions.map((d) => ({ id: d.divisionId, bounds: d.bounds })),
    ...system.clefChanges.map((c) => ({
      id: c.clefChangeId,
      bounds: c.bounds,
    })),
    { id: 'clef', bounds: system.clef.bounds },
  ];
  const rowTop = lyricRowTop(system.lyricBaselineY);
  const hasLyrics = system.lyrics.length > 0;
  for (const { id, bounds } of ink) {
    const top = Math.max(band.top, bounds.y);
    const bottom = Math.min(band.bottom, bounds.y + bounds.height);
    if (top < system.y + systemMusicPadding)
      violations.push(`${label} ${id} top ${top} above system`);
    if (bottom > system.y + system.height - systemMusicPadding)
      violations.push(`${label} ${id} bottom ${bottom} below system`);
    if (hasLyrics && bottom > rowTop)
      violations.push(`${label} ${id} bottom ${bottom} enters lyric row`);
  }
  for (const lyric of system.lyrics)
    if (lyric.y !== system.lyricBaselineY)
      violations.push(`${label} lyric ${lyric.syllableId} off baseline`);
  for (const hyphen of system.hyphens)
    if (hyphen.y !== system.lyricBaselineY)
      violations.push(`${label} hyphen off baseline`);
  if (
    hasLyrics &&
    system.lyricBaselineY + lyricDescent > system.y + system.height
  )
    violations.push(`${label} lyric row below system`);
  return violations;
}
