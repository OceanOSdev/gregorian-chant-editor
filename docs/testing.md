# Testing

## Scope

This document is authoritative for test strategy, repository commands,
fixtures, regression expectations, and manual browser verification.

## Related documents

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Commands and history](commands-and-history.md)
- [Layout and rendering](layout-and-rendering.md)
- [Editor interactions](editor-interactions.md)

## Test environment

Vitest runs the suite as plain TypeScript. The repository currently has no DOM
test environment, component testing library, browser automation dependency, or
coverage requirement.

Prefer tests at the smallest pure seam:

- domain validation, lookup, and normalization;
- immutable commands and insertion resolvers;
- document history, selection, and tools;
- graphical-placement and focus resolvers;
- layout, wrapping, lyric alignment, and preview geometry;
- pure accessibility-label and score-description helpers.

Do not rely on a component test for logic that can be expressed and tested as a
plain TypeScript function.

## Fixtures and assertions

Tests usually construct small `ChantDocument` fixtures inline. Use descriptive,
stable IDs such as `syllable-1`, `neume-podatus`, and `note-upper`, and create
pitch values with `staffPosition(...)`.

Parameterized matrices are useful for supported neume kinds, valid and invalid
pitch contours, insertion boundaries, and rejection paths. A regression test
should cover the narrowest seam that owns the contract.

Assertions should cover more than final values when identity matters:

- exact input reference for rejected or no-op commands;
- stable entity IDs and semantic order;
- structural sharing of unaffected data;
- invariant preservation after movement or normalization;
- one atomic history entry and exact undo/redo restoration;
- stable IDs and ordering across multi-system reflow;
- raw bounds, connector cardinality, and whole-neume wrapping;
- ID-free preview shape and preview/commit geometry parity;
- flattened multi-system accessibility totals.

## Automated and manual coverage

The automated suite covers pure accessibility descriptions and interaction
decisions. It does not execute actual React or browser behavior.

Manually verify important changes involving:

- DOM focus and focus restoration after keyed elements are reparented;
- browser `getScreenCTM()` and client-to-SVG pointer conversion;
- placement-mode pointer-event ownership;
- tab order and `aria-disabled` behavior;
- click and keyboard event propagation;
- visual clipping and selected-neume outlines;
- responsive SVG scaling and dynamic multi-system height.

## Commands

The exact supported Node.js version is declared in the repository-root
`.nvmrc`. Contributors using nvm can activate it before installation:

```bash
nvm use
npm ci
```

`npm ci` installs the exact dependency tree recorded in `package-lock.json`.
Use `npm install` only when intentionally adding, removing, or updating a
dependency so npm can update the manifest and lockfile together.

Apply deterministic formatting with:

```bash
npm run format
```

Check formatting without modifying files with:

```bash
npm run format:check
```

Run the standard local verification in this order:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Other available scripts are:

```bash
npm run test:watch
npm run dev
npm run preview
```

`npm test` invokes `vitest run`, runs the suite once, and exits.
`npm run test:watch` remains active and reruns tests while files change; do not
use it for the standard verification gate or CI.

`npm run dev` is the normal manual-interaction environment.

## Formatting changes

Prettier owns mechanical formatting, while Oxlint owns code-quality,
correctness, and framework diagnostics. Keep formatting-only changes
mechanical: do not combine a repository formatting pass with refactoring,
renaming, cleanup, test changes, or feature work. Review a formatting baseline
normally and with whitespace ignored to identify any non-mechanical change.

## Continuous integration

The `CI` GitHub Actions workflow runs for pull requests and pushes to `main`.
Its parallel `Format`, `Lint`, `Test`, and `Build` jobs each install locked
dependencies with `npm ci`, then run the corresponding command shown above.
The hosted status checks are normally reported as `CI / Format`, `CI / Lint`,
`CI / Test`, and `CI / Build`. The jobs intentionally repeat setup rather than
sharing `node_modules`, keeping each result independent and immediately
visible.

Reviewing the workflow structure or YAML locally does not prove hosted
execution. After pushing, confirm the workflow runs successfully and that a
newer push cancels an obsolete run for the same branch or pull request before
requiring all four CI checks in branch protection.

## Extension checklists

### Add a semantic neume kind

- Update the discriminated union and fixed tuple in the
  [domain model](domain-model.md).
- Extend runtime validation, lookup-dependent normalization where applicable,
  movement switches, layout geometry, lyric alignment, and accessible labels.
- Update exhaustive switches and add invariant, rejection, identity, command,
  layout, and accessibility tests.
- Do not assume the kind is graphically placeable.

### Make a kind graphically placeable

- Add it deliberately to the graphical-kind union and editor tool mapping.
- Extend placement contours, typed resolver results, preview input/output,
  connector geometry, and commit handling.
- Test system hit behavior, snapping, complete-neume midpoint boundaries,
  active-syllable clamping, long documents, reflow, and preview/commit parity.

### Change connector or notehead geometry

- Update raw-bounds expectations and connector cardinality.
- Test compact spacing, following-neume spacing, wrapping thresholds,
  selection outlines, lyric anchors, and preview/commit parity.
- Review whether exact-fit and oversized-neume progress cases still hold.

### Change `ChantLayout`

- Update every pure layout assertion and rendering consumer.
- Preserve or deliberately revise the documented absolute-coordinate and
  `startNeumeIndex` contracts.
- Update score totals and multi-system interaction resolvers when affected.

### Change accessibility descriptions

- Update the pure helper tests for every neume constituent and selected state.
- Check singular/plural score totals across multiple systems.
- Manually verify label relationships and keyboard use in the browser.

### Change command or history behavior

- Test acceptance, rejection, exact-reference no-op behavior, immutability,
  structural sharing, ID preservation, one history entry, undo/redo, and future
  clearing after a replacement edit.
- Update [commands and history](commands-and-history.md) when the contract
  changes.
