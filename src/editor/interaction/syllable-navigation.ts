/** Focus browsing only. Activation stays with native button Enter/Space/click. */
export function nextSyllableId(
  ids: readonly string[],
  current: string,
  key: string,
): string | null {
  const index = ids.indexOf(current);
  if (index < 0) return null;
  if (key === 'Home') return ids[0] ?? null;
  if (key === 'End') return ids.at(-1) ?? null;
  const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  return delta
    ? (ids[(index + delta + ids.length) % ids.length] ?? null)
    : null;
}
