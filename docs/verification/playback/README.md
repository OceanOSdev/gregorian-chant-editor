# Playback verification

Date: 2026-11-02. Branch: `one-shot-test`.

The production build passes the playback browser driver in Chromium. A real
AudioContext is created by a native Play-button click. The test inserts an
AnalyserNode in the output path and samples rendered floating-point PCM values;
the successful run measured nonzero RMS around 0.051. Pause, Stop and zero volume
all reduce the signal below the asserted silence threshold. This verifies actual
audio rendering, not a user's physical speaker or system volume.

Additional passing browser checks cover moving note highlights, unchanged semantic
selection and keyboard focus, exact pause/resume with one shared context, volume
recovery, tempo/register/edit cancellation, completion/replay, 320px containment
and visible errors when Web Audio is unavailable. Artifacts for the successful run
were written to `/tmp/chant-audio-VmmeWC` in this execution workspace.

The full suite passes: **48 files, 737 tests**. Formatting, Oxlint, TypeScript and
the Vite production build pass. Browser code uses no new package dependency.
The verification runtime is Node 24.19.0 and Chromium 154 on Debian 13.

The pure performance tests verify C-clef placement, negative staff positions,
octaves, natural diatonic pitches, frequencies, all seven neume kinds, empty
scores, stable IDs, equal timing, rejection and immutability. Fake-context renderer
tests cover transport races, bounded scheduling, suspension/errors and cleanup,
including a failed context initialization followed by successful retry.

No sung voice or chant-rhythm interpretation is claimed. Firefox, Safari, physical
mobile speakers and OS/browser mute settings were not tested. Browser autoplay
policies require clicking Play; a page load intentionally produces no sound.
See the [playback guide](../../playback.md) for the feature's supported behavior.
