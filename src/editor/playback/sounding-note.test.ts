import { describe, expect, it } from 'vitest';
import { createSoundingNoteStore } from './sounding-note';

describe('sounding note store', () => {
  it('notifies only on a change of note', () => {
    const store = createSoundingNoteStore();
    const seen: (string | null)[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.get()));
    store.set('a');
    store.set('a');
    store.set(null);
    store.set(null);
    store.set('b');
    expect(seen).toEqual(['a', null, 'b']);
    unsubscribe();
    store.set('c');
    expect(seen).toEqual(['a', null, 'b']);
  });

  it('counts playbacks without notifying', () => {
    const store = createSoundingNoteStore();
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.playbackCount()).toBe(0);
    store.beginPlayback();
    store.beginPlayback();
    expect(store.playbackCount()).toBe(2);
    expect(notified).toBe(0);
  });
});
