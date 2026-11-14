// Executable manifest of routine browser regression drivers.
//
// The human-readable inventory in ../README.md links here; this file is the
// single source of truth for what the runner may launch. Script paths are
// relative to docs/verification/. Only current routine regressions belong
// here: historical, comparison-board, raster/weight, legacy-storage and
// baseline/diagnostic scripts are deliberately absent.
//
// server:     'dev'     -> Vite dev server serving the real shared fixture
//                          (placement/browser-fixture.html); driver receives
//                          CHANT_EDITOR_URL (origin, no trailing slash).
//             'preview' -> one production build per run served by
//                          `vite preview`; driver receives CHANT_PREVIEW_URL.
// browsers:   transports the driver actually implements. 'chromium' means
//             CDP via CHANT_CHROMIUM_URL; 'firefox' means WebDriver BiDi via
//             CHANT_FIREFOX_URL. Do not add a browser a driver lacks code for.

export const BROWSERS = /** @type {const} */ (['chromium', 'firefox']);

export const TRANSPORTS = {
  chromium: 'Chromium/CDP',
  firefox: 'Firefox/BiDi',
};

export const DRIVERS = [
  {
    id: 'continuous-lyrics',
    script: 'continuous-lyrics/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium'],
  },
  {
    id: 'lyric-move',
    script: 'lyric-move/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium'],
  },
  {
    id: 'vowel-alignment',
    script: 'vowel-alignment/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium'],
  },
  {
    id: 'lyric-spacing',
    script: 'lyric-spacing/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium'],
  },
  {
    id: 'lyric-spacing-selection-cue',
    script: 'lyric-spacing/selection-cue-firefox.mjs',
    server: 'dev',
    browsers: ['firefox'],
  },
  {
    id: 'word-composition',
    script: 'word-composition/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'clefs',
    script: 'clefs/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium'],
  },
  {
    id: 'mid-score-clefs',
    script: 'mid-score-clefs/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium', 'firefox'],
    knownIssue:
      'Firefox: intermittent, unresolved 150% zoom pointer-insertion failure ' +
      '(Stage 9B-2 investigation). Run unchanged; a failure is reported, not waived.',
  },
  {
    id: 'divisions',
    script: 'divisions/browser-check.mjs',
    server: 'dev',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'compound-directional-neumes',
    script: 'compound-directional-neumes/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'extended-scandicus-climacus',
    script: 'extended-scandicus-climacus/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'pes-subpunctis',
    script: 'pes-subpunctis/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'repeated-note-neumes',
    script: 'repeated-note-neumes/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'note-modifiers',
    script: 'note-modifiers/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'note-shapes',
    script: 'note-shapes/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'b-accidentals',
    script: 'b-accidentals/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'b-accidentals-acceptance',
    script: 'b-accidentals/acceptance-browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'local-persistence',
    script: 'local-persistence/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'bundled-example',
    script: 'bundled-example/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'vertical-episemata',
    script: 'vertical-episemata/browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
  {
    id: 'vertical-episemata-context',
    script: 'vertical-episemata/context-browser-check.mjs',
    server: 'preview',
    browsers: ['chromium', 'firefox'],
  },
];

// Presets name driver IDs; each is paired with every requested browser it
// supports. The smoke preset is small and fast: dev-fixture lyric editing
// (vowel-alignment, Chromium/CDP only; no current passing Firefox lyric
// driver exists, so Firefox gets the dev-fixture divisions driver as its dev
// counterpart) and real production preview editing/persistence with storage
// clearing (local-persistence) in each requested browser.
export const PRESETS = {
  smoke: ['vowel-alignment', 'divisions', 'local-persistence'],
  full: DRIVERS.map((driver) => driver.id),
};

// Every inherited variable with this prefix is removed from a job before the
// runner sets its own. That covers endpoint/transport overrides
// (CHANT_EDITOR_URL, CHANT_PREVIEW_URL, CHANT_CHROMIUM_URL, CHANT_FIREFOX_URL,
// the historical CHANT_CHROME_URL) and non-test modes (CHANT_BASELINE,
// CHANT_CORPUS, CHANT_LEGACY_URL), so ambient shell settings can neither
// redirect a job nor silently change its coverage. Standalone use outside the
// runner still honours them.
export const STRIPPED_ENV_PREFIX = 'CHANT_';
