interface RenderedLyric {
  id: string;
  left: number;
  right: number;
}
interface RenderedMark {
  left: number;
  right: number;
  outgoing: boolean;
}
interface RenderedSystem {
  index: number;
  lyrics: readonly RenderedLyric[];
  marks: readonly RenderedMark[];
}
interface ExpectedBoundary {
  beforeId: string;
  afterId: string;
  before: string;
  after: string;
  kind: string;
  gap: number | null;
}
function requireCondition(valid: boolean, message: string) {
  if (!valid) throw new Error(message);
}
/** Compare committed DOM marks with semantic continuation intervals, not pixels. */
export function assertRenderedContinuations(
  boundaries: readonly ExpectedBoundary[],
  systems: readonly RenderedSystem[],
  tolerance = 0.05,
): void {
  const lyrics = new Map(
    systems.flatMap((s) =>
      s.lyrics.map((t) => [t.id, { ...t, system: s.index }] as const),
    ),
  );
  const matched = new Set<string>();
  for (const b of boundaries) {
    const before = lyrics.get(b.beforeId),
      after = lyrics.get(b.afterId);
    if (!before || !after) throw new Error('missing rendered syllable');
    const separated = before.system !== after.system;
    const marked = b.kind === 'hyphen' || b.kind === 'outgoing';
    requireCondition(
      separated ===
        (b.kind === 'outgoing' || (b.kind === 'word' && b.gap === null)),
      'committed system differs from measured layout',
    );
    const candidates = systems
      .flatMap((s) =>
        s.marks.map((mark, index) => ({
          mark,
          system: s.index,
          key: `${s.index}:${index}`,
        })),
      )
      .filter(
        ({ mark, system }) =>
          system === before.system &&
          mark.outgoing === separated &&
          mark.left >= before.right - tolerance &&
          (separated || mark.right <= after.left + tolerance),
      );
    if (marked) {
      const available = candidates.filter((c) => !matched.has(c.key));
      requireCondition(
        available.length === 1,
        `${b.before}/${b.after}: required rendered continuation mark missing or ambiguous`,
      );
      matched.add(available[0].key);
    }
  }
  requireCondition(
    matched.size === systems.reduce((sum, s) => sum + s.marks.length, 0),
    'unexpected or wrong-system rendered continuation mark',
  );
}
