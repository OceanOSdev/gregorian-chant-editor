import type { GraphicalNeumeKind } from '../layout/layout-chant';

export const paletteTools = [
  'select',
  'punctum',
  'podatus',
  'clivis',
  'scandicus',
  'torculus',
  'climacus',
  'porrectus',
] as const;
export type PaletteTool = 'select' | GraphicalNeumeKind;

/** Focus navigation only; activation remains native button Enter/Space/click. */
export function nextPaletteTool(
  current: PaletteTool,
  key: string,
): PaletteTool | null {
  const index = paletteTools.indexOf(current);
  if (key === 'Home') return paletteTools[0];
  if (key === 'End') return paletteTools[paletteTools.length - 1];
  const delta =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? -1
        : 0;
  return delta
    ? paletteTools[(index + delta + paletteTools.length) % paletteTools.length]
    : null;
}

interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
}

export function getNotationShortcut(
  event: ShortcutKey,
  notationFocused: boolean,
): 'insert' | 'focus-palette' | null {
  if (
    !notationFocused ||
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat
  )
    return null;
  const key = event.key.toLowerCase();
  return key === 'i' ? 'insert' : key === 't' ? 'focus-palette' : null;
}
