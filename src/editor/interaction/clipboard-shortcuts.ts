import {
  pasteIdCount,
  type MusicalClipboard,
} from '../commands/musical-passage-clipboard';

interface ClipboardShortcutKey {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
}

/**
 * Ctrl/Cmd+C and Ctrl/Cmd+V inside the editor's clipboard scope only. Native text targets
 * are excluded by the caller; an actual browser text selection keeps native
 * copy. Key repeat is still claimed (so it cannot reach the browser) but the
 * caller dispatches only the first press.
 */
export function getClipboardShortcut(
  event: ClipboardShortcutKey,
  inClipboardScope: boolean,
  hasTextSelection: boolean,
): 'copy' | 'paste' | null {
  if (
    !inClipboardScope ||
    event.defaultPrevented ||
    event.isComposing ||
    !(event.ctrlKey || event.metaKey) ||
    event.altKey ||
    event.shiftKey
  )
    return null;
  const key = event.key.toLowerCase();
  if (key === 'c') return hasTextSelection ? null : 'copy';
  return key === 'v' ? 'paste' : null;
}

/** The single interaction-boundary allocation for one paste. */
export function allocatePasteIds(
  clipboard: MusicalClipboard | null,
  randomId: () => string = () => crypto.randomUUID(),
): string[] {
  return clipboard
    ? Array.from({ length: pasteIdCount(clipboard) }, randomId)
    : [];
}
