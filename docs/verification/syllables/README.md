# Legacy syllable-entry verification

Historical coverage of the pre-anchor Add/Edit/Save/Cancel workflow and roving
syllable strip. Stages 1 and 2 replaced this interaction with anchored lyrics and
continuous entry. This folder does not describe the current editor.

The [historical driver](browser-check.mjs) is preserved for its detailed native
keyboard, scrolling, composition and draft-retention scenarios. Its fixtures lack
`startsAtNeumeId` and `boundaryBefore`; its `#new-syllable`, `#edit-syllable`,
Add/Save/Cancel controls and strip activation expectations are obsolete. It cannot
be run successfully against the current editor without deliberate adaptation.
Do not treat it as current regression coverage.

The nine screenshots and generated `browser-results.json` were one-off run
outputs, not asserted image baselines or approved engraving references. They
have been removed; Git history retains the original run and visual record.
The driver now writes any diagnostic outputs to a fresh system temporary
directory and prints its location instead of modifying tracked files.

Current [Stage 2 browser coverage](../continuous-lyrics/README.md) exercises
native input, focus, selection, deliberate editing, draft recovery, composition
guards, responsive bounds and atomic lyric history. The pure
`syllable-workflow.test.ts` and `lyric-anchors.test.ts` suites own session and
semantic invariants. The old strip's roving keys, automatic blank-syllable
creation and Save/Cancel workflow intentionally have no direct replacement.

Porting any still-useful scroll stress scenarios to the current workflow is a
separate testing task, not part of this housekeeping change.
