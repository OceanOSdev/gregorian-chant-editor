import { useEffect } from 'react';
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

function noteElement(noteId: string): Element | null {
  return document.querySelector(
    `.score__note[data-note-id="${CSS.escape(noteId)}"]`,
  );
}

/**
 * Keeps the sounding note on screen during playback, across systems and the
 * horizontally scrollable score, below the sticky toolbar. It scrolls only
 * (minimal, instant reveal); it never focuses, selects or changes the score.
 */
export function useFollowSoundingNote(store: SoundingNoteStore) {
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
      const target = noteElement(next);
      const previousElement = previous ? noteElement(previous) : null;
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
  }, [store]);
}
