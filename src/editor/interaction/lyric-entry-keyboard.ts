export interface LyricKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

/** L is local to notation in Select; native inputs keep their full keyboard. */
export function isLyricEntryShortcut(
  event: LyricKeyEvent,
  notationFocused: boolean,
  placing: boolean,
): boolean {
  return (
    notationFocused &&
    !placing &&
    !event.isComposing &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'l'
  );
}

export type SyllableKeyAction =
  | { type: 'select' | 'edit' | 'delete' }
  | { type: 'advance'; key: '-' | ' ' | '_' }
  | { type: 'replace'; text: string };

/** Focus alone does not select lyrics; Space selects before it can advance. */
export function getSyllableKeyAction(
  event: LyricKeyEvent,
  selected: boolean,
  placing: boolean,
): SyllableKeyAction | null {
  if (
    placing ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return null;
  if (event.key === 'Enter') return event.repeat ? null : { type: 'edit' };
  if (event.key === ' ' && !selected)
    return event.repeat ? null : { type: 'select' };
  if (!selected) return null;
  if (event.key === '-' || event.key === ' ' || event.key === '_')
    return event.repeat ? null : { type: 'advance', key: event.key };
  if (event.key === 'Delete' || event.key === 'Backspace')
    return event.repeat ? null : { type: 'delete' };
  return event.key.length === 1 ? { type: 'replace', text: event.key } : null;
}
