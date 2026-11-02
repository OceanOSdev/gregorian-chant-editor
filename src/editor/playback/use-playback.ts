import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import { createPerformance } from './performance';
import { AudioPlayer } from './audio-player';

export function usePlayback(
  document: ChantDocument,
  blocked: boolean,
  resetKey: object = document,
) {
  const [tempo, setTempo] = useState(100);
  const [volume, setVolume] = useState(0.5);
  const [octave, setOctave] = useState(0);
  const [follow, setFollow] = useState(true);
  const [status, setStatus] = useState<
    'stopped' | 'starting' | 'playing' | 'paused'
  >('stopped');
  const [position, setPosition] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState('');
  const player = useRef<AudioPlayer | null>(null);
  const generation = useRef(0);
  const lastProgress = useRef<{ quarter: number; noteId: string | null }>({
    quarter: -1,
    noteId: null,
  });
  const result = useMemo(() => {
    try {
      return {
        performance: createPerformance(document, tempo, octave),
        error: '',
      };
    } catch (error) {
      return {
        performance: null,
        error:
          error instanceof Error ? error.message : 'Cannot play this score.',
      };
    }
  }, [document, tempo, octave]);
  const stop = useCallback(() => {
    generation.current++;
    player.current?.stop();
    setStatus('stopped');
    setPosition(0);
    setActiveNoteId(null);
  }, []);
  useEffect(() => {
    stop();
    setAudioError('');
  }, [document, tempo, octave, resetKey, stop]);
  useEffect(() => {
    if (blocked) stop();
  }, [blocked, stop]);
  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);
  useEffect(() => {
    function hidden() {
      if (globalThis.document.hidden) {
        generation.current++;
        const seconds = player.current?.pause() ?? 0;
        setPosition(seconds);
        setActiveNoteId(null);
        setStatus((previous) =>
          previous === 'playing' || previous === 'starting'
            ? 'paused'
            : previous,
        );
      }
    }
    globalThis.document.addEventListener('visibilitychange', hidden);
    return () =>
      globalThis.document.removeEventListener('visibilitychange', hidden);
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      player.current?.destroy();
      player.current = null;
    },
    [],
  );

  async function play() {
    if (blocked || !result.performance?.notes.length || status === 'starting')
      return;
    const current = ++generation.current;
    setAudioError('');
    if (!player.current)
      player.current = new AudioPlayer(
        (seconds, noteId, ended) => {
          const quarter = Math.floor(seconds * 4);
          if (
            ended ||
            quarter !== lastProgress.current.quarter ||
            noteId !== lastProgress.current.noteId
          ) {
            lastProgress.current = { quarter, noteId };
            setPosition(seconds);
            setActiveNoteId(noteId);
          }
          if (ended) setStatus('stopped');
        },
        (message) => {
          setAudioError(message);
          setStatus((previous) =>
            previous === 'playing' || previous === 'paused'
              ? 'paused'
              : 'stopped',
          );
          setActiveNoteId(null);
        },
      );
    player.current.setVolume(volume);
    const offset =
      status === 'paused' && position < result.performance.duration
        ? position
        : 0;
    lastProgress.current = { quarter: -1, noteId: null };
    setStatus('starting');
    try {
      await player.current.play(result.performance, offset);
      if (generation.current === current) setStatus('playing');
    } catch (error) {
      if (generation.current !== current) return;
      setAudioError(
        error instanceof Error
          ? error.message
          : 'Your browser could not start audio. Try Play again.',
      );
      setStatus('stopped');
      setActiveNoteId(null);
    }
  }
  function pause() {
    generation.current++;
    const seconds = player.current?.pause() ?? 0;
    setPosition(seconds);
    setActiveNoteId(null);
    setStatus('paused');
  }
  return {
    tempo,
    setTempo,
    volume,
    setVolume,
    octave,
    setOctave,
    follow,
    setFollow,
    status,
    position,
    activeNoteId,
    error: result.error || audioError,
    duration: result.performance?.duration ?? 0,
    noteCount: result.performance?.notes.length ?? 0,
    blocked,
    play,
    pause,
    stop,
  };
}
export type PlaybackState = ReturnType<typeof usePlayback>;
