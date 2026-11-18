import { useEffect, type RefObject } from 'react';
import type { SoundingNoteStore } from '../playback/sounding-note';
import { isElementOnScreen, revealElement } from './focus-visibility';

/**
 * Follow policy: reveal the first sounding note of a playback; afterwards
 * reveal the next note only while the previous one is still at least partly
 * on screen. If the reader scrolls the sounding note away, following pauses
 * instead of fighting them, and resumes once it is visible again.
 */
export function shouldRevealSoundingNote(previous: {
  exists: boolean;
  onScreen: boolean;
}): boolean {
  return !previous.exists || previous.onScreen;
}

function noteElement(root: Element | null, noteId: string): Element | null {
  return (
    root?.querySelector(`.score__note[data-note-id="${CSS.escape(noteId)}"]`) ??
    null
  );
}

/**
 * Keeps the sounding note on screen during playback, across systems and the
 * horizontally scrollable score, below the sticky toolbar. It scrolls only
 * (minimal, instant reveal); it never focuses, selects or changes the score.
 * Notes are looked up within `scoreRoot`, this editor's score.
 */
export function useFollowSoundingNote(
  store: SoundingNoteStore,
  scoreRoot: RefObject<Element | null>,
) {
  useEffect(() => {
    let playback = store.playbackCount();
    let previous: string | null = null;
    return store.subscribe(() => {
      const next = store.get();
      if (store.playbackCount() !== playback) {
        playback = store.playbackCount();
        previous = null;
      }
      // Silences between notes (division pauses) keep the previous note.
      if (!next) return;
      const target = noteElement(scoreRoot.current, next);
      const previousElement = previous
        ? noteElement(scoreRoot.current, previous)
        : null;
      previous = next;
      if (!target) return;
      if (
        shouldRevealSoundingNote({
          exists: previousElement !== null,
          onScreen: previousElement
            ? isElementOnScreen(previousElement)
            : false,
        })
      )
        revealElement(target);
    });
  }, [store, scoreRoot]);
}
