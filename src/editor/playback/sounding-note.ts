import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * The note ID currently sounding, for presentation only (score cue and
 * follow scrolling). One store per editor; it is not document, session or
 * history state, and nothing in it is persisted.
 */
export interface SoundingNoteStore {
  get(): string | null;
  set(noteId: string | null): void;
  /** Increments when a playback begins, so followers can tell sessions apart. */
  playbackCount(): number;
  beginPlayback(): void;
  subscribe(listener: () => void): () => void;
}

export function createSoundingNoteStore(): SoundingNoteStore {
  let current: string | null = null;
  let playbacks = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    playbackCount: () => playbacks,
    beginPlayback() {
      playbacks++;
    },
    set(noteId) {
      if (noteId === current) return;
      current = noteId;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const SoundingNoteContext = createContext<SoundingNoteStore | null>(
  null,
);

const noSubscription = () => () => {};

/**
 * Whether this note is sounding. Each note subscribes to its own boolean, so
 * a change re-renders only the notes whose answer changed, never the score.
 */
export function useIsNoteSounding(noteId: string): boolean {
  const store = useContext(SoundingNoteContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    () => store?.get() === noteId,
  );
}
