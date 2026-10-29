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
