import type { PlaybackState } from '../playback/use-playback';

function clock(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
export function PlaybackControls({ playback }: { playback: PlaybackState }) {
  const { status } = playback;
  return (
    <section className="playback-controls" aria-label="Audio playback">
      <div className="playback-transport">
        <span className="app-eyebrow">LISTEN</span>
        <button
          type="button"
          className="playback-play"
          disabled={
            playback.blocked ||
            !playback.noteCount ||
            Boolean(playback.error && status === 'starting')
          }
          onClick={() => {
            if (status === 'playing' || status === 'starting') playback.pause();
            else void playback.play();
          }}
          aria-label={
            status === 'playing' || status === 'starting'
              ? 'Pause playback'
              : status === 'paused'
                ? 'Resume playback'
                : 'Play chant'
          }
        >
          {status === 'playing' || status === 'starting'
            ? 'Pause'
            : status === 'paused'
              ? 'Resume'
              : 'Play'}
        </button>
        <button
          type="button"
          disabled={status === 'stopped' && playback.position === 0}
          onClick={playback.stop}
        >
          Stop
        </button>
        <span className="playback-time" aria-label="Playback time">
          {clock(playback.position)} / {clock(playback.duration)}
        </span>
        <span className="playback-state" role="status">
          {status === 'starting'
            ? 'Starting audio…'
            : status === 'playing'
              ? 'Playing'
              : status === 'paused'
                ? 'Paused'
                : playback.noteCount
                  ? 'Ready'
                  : 'Add notes to listen'}
        </span>
      </div>
      <div className="playback-settings">
        <label>
          Tempo <output>{playback.tempo} notes/min</output>
          <input
            type="range"
            aria-label="Playback tempo"
            min={40}
            max={180}
            step={5}
            value={playback.tempo}
            onChange={(event) =>
              playback.setTempo(Number(event.currentTarget.value))
            }
          />
        </label>
        <label>
          Volume <output>{Math.round(playback.volume * 100)}%</output>
          <input
            type="range"
            aria-label="Playback volume"
            min={0}
            max={1}
            step={0.05}
            value={playback.volume}
            onChange={(event) =>
              playback.setVolume(Number(event.currentTarget.value))
            }
          />
        </label>
        <label>
          Register
          <select
            aria-label="Playback register"
            value={playback.octave}
            onChange={(event) =>
              playback.setOctave(Number(event.currentTarget.value))
            }
          >
            <option value={-12}>Lower octave</option>
            <option value={0}>Written octave</option>
            <option value={12}>Higher octave</option>
          </select>
        </label>
        <label className="playback-follow">
          <input
            type="checkbox"
            checked={playback.follow}
            onChange={(event) =>
              playback.setFollow(event.currentTarget.checked)
            }
          />{' '}
          Follow notes
        </label>
      </div>
      <p className="playback-description">
        Organ tone · equal note lengths · pitches follow the C clef. This is a
        listening aid, without sung words or interpreted chant rhythm.
      </p>
      {playback.error && (
        <p role="alert" className="document-error">
          {playback.error}
        </p>
      )}
    </section>
  );
}
