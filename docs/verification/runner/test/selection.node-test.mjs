// Run with: npm run test:verify-runner
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DRIVERS, PRESETS } from '../manifest.mjs';
import { cleanEnv } from '../resources.mjs';
import {
  DEFAULTS,
  UsageError,
  formatList,
  parseCliArgs,
  selectJobs,
} from '../selection.mjs';

const VERIFICATION = join(import.meta.dirname, '../..');
const pairs = ({ runnable }) =>
  runnable.map(({ driver, browser }) => `${driver.id}:${browser}`);

describe('parseCliArgs', () => {
  it('defaults to a Chromium smoke run at concurrency 2', () => {
    const options = parseCliArgs([]);
    assert.equal(options.preset, 'smoke');
    assert.deepEqual(options.browsers, ['chromium']);
    assert.equal(options.concurrency, 2);
    assert.equal(
      options.startupTimeoutMs,
      DEFAULTS.startupTimeoutSeconds * 1000,
    );
    assert.equal(options.jobTimeoutMs, DEFAULTS.jobTimeoutSeconds * 1000);
  });

  it('expands both, accepts lists and repeated driver IDs', () => {
    const options = parseCliArgs([
      '--browser',
      'both',
      '--driver',
      'clefs,divisions',
      '--driver',
      'lyric-move',
      '-j',
      '1',
    ]);
    assert.deepEqual(options.browsers, ['chromium', 'firefox']);
    assert.deepEqual(options.driverIds, ['clefs', 'divisions', 'lyric-move']);
    assert.equal(options.preset, null);
    assert.equal(options.concurrency, 1);
  });

  it('rejects unknown browsers, bad numbers and conflicting selection', () => {
    for (const args of [
      ['--browser', 'safari'],
      ['--concurrency', '0'],
      ['--concurrency', '1.5'],
      ['--job-timeout', 'soon'],
      ['--driver', 'clefs', '--preset', 'full'],
      ['--unknown'],
      ['positional'],
    ]) {
      assert.throws(() => parseCliArgs(args), UsageError, args.join(' '));
    }
  });

  it('reads browser binary overrides from flags before the environment', () => {
    const env = {
      CHANT_RUNNER_CHROMIUM_BINARY: '/env/chromium',
      CHANT_RUNNER_FIREFOX_BINARY: '/env/firefox',
    };
    const options = parseCliArgs(['--firefox-binary', '/flag/firefox'], env);
    assert.deepEqual(options.binaries, {
      chromium: '/env/chromium',
      firefox: '/flag/firefox',
    });
  });
});

describe('selectJobs', () => {
  it('selects explicit drivers in every requested supported browser', () => {
    const selection = selectJobs(
      parseCliArgs([
        '--driver',
        'divisions,local-persistence',
        '--browser',
        'both',
      ]),
    );
    assert.deepEqual(pairs(selection), [
      'divisions:chromium',
      'divisions:firefox',
      'local-persistence:chromium',
      'local-persistence:firefox',
    ]);
    assert.deepEqual(selection.unsupported, []);
  });

  it('fails for unknown IDs and explicitly requested unsupported pairs', () => {
    assert.throws(
      () => selectJobs(parseCliArgs(['--driver', 'nope'])),
      /Unknown driver ID\(s\): nope/,
    );
    assert.throws(
      () =>
        selectJobs(
          parseCliArgs([
            '--driver',
            'continuous-lyrics',
            '--browser',
            'firefox',
          ]),
        ),
      /does not support firefox/,
    );
    // The Firefox-only cue is not silently run in Chromium by default.
    assert.throws(
      () =>
        selectJobs(parseCliArgs(['--driver', 'lyric-spacing-selection-cue'])),
      /supports firefox only/,
    );
    assert.throws(
      () => selectJobs(parseCliArgs(['--preset', 'nightly'])),
      /Unknown preset/,
    );
  });

  it('reports unsupported pairs in a multi-browser request without failing', () => {
    const selection = selectJobs(
      parseCliArgs([
        '--driver',
        'continuous-lyrics,divisions',
        '--browser',
        'both',
      ]),
    );
    assert.deepEqual(pairs(selection), [
      'continuous-lyrics:chromium',
      'divisions:chromium',
      'divisions:firefox',
    ]);
    assert.deepEqual(
      selection.unsupported.map(
        ({ driver, browser }) => `${driver.id}:${browser}`,
      ),
      ['continuous-lyrics:firefox'],
    );
  });

  it('fails on an empty selection', () => {
    assert.throws(
      () =>
        selectJobs(
          { driverIds: [], preset: 'empty', browsers: ['chromium'] },
          DRIVERS,
          { empty: [] },
        ),
      /no runnable/,
    );
  });

  it('full with both browsers selects every supported pair from the manifest', () => {
    const selection = selectJobs(
      parseCliArgs(['--preset', 'full', '--browser', 'both']),
    );
    const expected = DRIVERS.flatMap((driver) =>
      ['chromium', 'firefox']
        .filter((browser) => driver.browsers.includes(browser))
        .map((browser) => `${driver.id}:${browser}`),
    );
    assert.deepEqual(pairs(selection), expected);
    assert.equal(selection.runnable.length, 34);
    assert.equal(selection.unsupported.length, 6);
  });

  it('smoke covers dev lyrics and preview persistence in each browser', () => {
    for (const browser of ['chromium', 'firefox']) {
      const selection = selectJobs(parseCliArgs(['--browser', browser]));
      const servers = selection.runnable.map(({ driver }) => driver.server);
      assert.ok(
        servers.includes('dev') && servers.includes('preview'),
        browser,
      );
      assert.ok(pairs(selection).includes(`local-persistence:${browser}`));
      assert.deepEqual(selection.unsupported, []);
    }
  });
});

describe('manifest', () => {
  it('has unique IDs, existing scripts and only routine regressions', () => {
    const ids = DRIVERS.map((driver) => driver.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const driver of DRIVERS) {
      assert.ok(existsSync(join(VERIFICATION, driver.script)), driver.script);
      assert.doesNotMatch(
        driver.script,
        /render-|raster|weight|storage-review|baseline|corpus|lyric-anchors|syllables\/|placement\//,
      );
      assert.ok(['dev', 'preview'].includes(driver.server));
    }
    for (const ids of Object.values(PRESETS)) {
      for (const id of ids)
        assert.ok(DRIVERS.some((driver) => driver.id === id));
    }
  });

  it('declares only transports and endpoints each driver actually reads', () => {
    for (const driver of DRIVERS) {
      const source = readFileSync(join(VERIFICATION, driver.script), 'utf8');
      const reads = (name) => source.includes(`process.env.${name}`);
      assert.equal(
        reads('CHANT_FIREFOX_URL'),
        driver.browsers.includes('firefox'),
        driver.id,
      );
      assert.equal(
        reads('CHANT_CHROMIUM_URL'),
        driver.browsers.includes('chromium'),
        driver.id,
      );
      assert.ok(
        reads(
          driver.server === 'dev' ? 'CHANT_EDITOR_URL' : 'CHANT_PREVIEW_URL',
        ),
        driver.id,
      );
      assert.doesNotMatch(
        source,
        /fetch\('http:\/\/127\.0\.0\.1:\d+\/json'\)/,
        driver.id,
      );
    }
  });

  it('lists without launching', () => {
    const text = formatList();
    for (const driver of DRIVERS) assert.match(text, new RegExp(driver.id));
  });
});

describe('cleanEnv', () => {
  it('removes every inherited CHANT_* override and diagnostic mode', () => {
    const env = cleanEnv({
      PATH: '/bin',
      HOME: '/home/x',
      CHANT_BASELINE: '1',
      CHANT_CORPUS: 'diagnostic',
      CHANT_LEGACY_URL: 'http://old',
      CHANT_FIREFOX_URL: 'ws://elsewhere/session',
      CHANT_CHROMIUM_URL: 'http://elsewhere/json',
      CHANT_EDITOR_URL: 'http://elsewhere',
      CHANT_PREVIEW_URL: 'http://elsewhere/',
      CHANT_CHROME_URL: 'http://historical',
    });
    assert.deepEqual(env, { PATH: '/bin', HOME: '/home/x' });
  });
});
