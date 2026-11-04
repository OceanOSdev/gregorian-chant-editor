# Stage 6A conventions follow-up

Follow-up to owner-supplied review of PR #54 at `2af8319`.
All seven findings addressed, including the optional direct-return cleanup of
`transposeNeume` and merging its identical three-note arms. No engraving recipe,
pitch formula or UI behavior changed. No architectural conflict was found.

- Clef pitch bases, geometry extents/offsets/path selection and spoken syllables
  use exhaustive `Record<Clef['type'], …>` maps.
- Domain `clef.ts` owns the unchanged runtime validator and shared clef name.
  UI and commands consume validation there; both accessible strings use one name.
- Clef geometry reuses `LayoutBounds`; the layout comment describes the shared body.
- Session imports from `chant-document` are consolidated.
- The retained Stage 6A plan now records implemented status and owner closeout
  choices. ADR 0014 remains Proposed and unchanged. Stages 6B/6C remain deferred.

## Fresh verification

On Node 24.18.0, format check, lint, all 1,032 tests in 54 files, production
build and `git diff --check` passed. The two additional tests exercise domain
validation boundaries and consistent names across all eight clefs. Existing
command matrices retain invalid/no-op identity and every-pair pitch preservation.

A temporary baseline diagnostic transpiled the builder at `2af8319` and the
current builder with identical staff metrics. Deep equality passed for all
paths, occupied bounds, hit bounds and anchors in 24 cases: both types × all
four lines × three placements (origin, score coordinates and fractional
coordinates). The approved production geometry is byte-identical at these
placements; no new visual-design acceptance is needed for this cleanup.

The real-editor Chromium clef driver passed all 16 type/line/viewport specimens,
actual SVG bounds, native pointer/keyboard, focus, history, dirty lyric drafts,
empty scores and placement at desktop and 320px. Fresh generated screenshots
remain in temporary storage, per verification policy. The committed
[approved comparison and production captures](shared-body-adoption.md) remain
unchanged. These checks do not claim foreground Firefox/OS/IME or spoken
screen-reader acceptance; unrelated historical corpus/driver runs are not
represented as fresh current-head checks.

## Local study-folder disposition

Inspected every file in the untracked `attachment-refinement/`,
`c-contour-prototype/` and `weight-study/` directories: intermediate comparison
PNGs, self-contained HTML, measurements, generators and punctum context.
The approved attachment comparison is already retained as
`shared-body-comparison.png`; the adoption record preserves reference provenance,
measurements and actual editor specimens. The other studies document rejected
or intermediate options and add no production dependency. Their generators
also read the evolving builder, so they are not stable historical reproducers.

Leave these local folders untouched and deliberately exclude them from this
commit. Do not delete, broadly ignore, or commit them as additional approved
assets. The committed adoption record and frozen geometry regression carry the
accepted design evidence. No unrelated local work was modified.
