# One-shot editor probe

Branch: `one-shot-test`. Target: `master`. Experimental, not a merge recommendation.

The owner requested an autonomous implementation probe with minimal further input.
This plan records inferred scope, not new product commitments.

## Goal and scope

Complete a usable local modern square-notation workbench around the existing seven
neume types: new/example documents, title and clef editing, versioned validated
JSON files, browser autosave/recovery, supported-subset GABC interchange, clean SVG
export and printing, responsive controls, visual neume tools, pitch controls,
and experimental measured lyric spacing/conditional continuation hyphens.
Keep semantic documents, commands, layout, rendering and browser adapters separate.
All document edits remain undoable. File replacement deliberately resets history;
warn about losing work and uncommitted lyric drafts. Failed imports preserve work.

No backend, authentication, collaboration, audio, new notation traditions, or
claim of full GABC/publication-quality engraving support. Do not publish a website.
Unsupported interchange constructs must fail visibly rather than silently disappear.
JSON is the lossless format; GABC explicitly omits editorial alignment preferences.

## Architecture and review

Preserve accepted ADRs. Propose lyric-aware wrapping separately; retain legacy
music-only layout as the default API policy and enable the experiment in this
branch's app. Use measured text clearances in a terminating whole-neume placement
walk, share visible layout with graphical insertion, preserve stable identity,
and never store hyphens or system membership in semantic data.

## Verification and delivery

Add focused persistence/interchange/spacing regression tests. Run format, lint,
all tests and production build, then real Chromium keyboard/pointer/file/reload
and narrow viewport checks if a browser is available. Record limits honestly.
Commit and push this branch; do not merge. Record implementation outcome and
known limitations here at completion.
