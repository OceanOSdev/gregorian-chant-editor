# Plan: Editor readability M4B-3a — initial clef and lyric-language panels

Branch: `refactor/editor-readability-m4b-3a`
Target: `master`
Base: `ea27b0b` (PR #110, M4B-2, merged)
Status: Completed (historical record). Implemented and merged in [PR #111](https://github.com/OceanOSdev/gregorian-chant-editor/pull/111) (merge `d1439ed`). The PR holds the actual verification, including any checks not performed. The branch and base above describe the milestone as implemented.

This is milestone M4B-3a of the
[M4B plan](editor-readability-m4b.md#m4b-3a-initial-clef-and-lyric-language-panels).
That plan owns the background, agreed decisions (Approach A), behavior
preservation, verification strategy and stop conditions. This document records
only this milestone's scope and specifics.

## Scope

1. **`InitialClefControls`** renders the Initial clef fieldset unchanged. Props:
   `clef` (the document's initial clef), `disabled` and
   `onChangeClef(clef)`. Each select builds the candidate clef from `clef` and
   calls `onChangeClef` only when `isValidClef` accepts it, as before.
2. **`LyricLanguageControls`** renders the Lyric language label and its
   explanatory paragraph as a fragment, so both stay direct children of
   `main.chant-editor`. Props: `language` (already normalized by the shell),
   `disabled` and `onChangeLanguage(language)`, which receives the normalized
   select value.
3. **`ChantEditor` keeps ownership** of the session, availability and dispatch:
   - `disabled` comes from the M4B-1 rules `exclusiveModeActive` and
     `lyricLanguageBlocked`, not from conditions copied into the components;
   - the callbacks dispatch `change-clef` and the `engraving-edit` with
     `updateLyricLanguage` exactly as before;
   - panel composition and order are unchanged.

Neither component receives `session` or `dispatch`. `ClefChangeControls` is
unchanged. `docs/architecture.md` lists the two components and their
ownership.

## Verification

- The standard gate and the M4B-3a driver set (`clefs`, `vowel-alignment`,
  `lyric-spacing`, `local-persistence`) in Chromium and Firefox where
  supported, compared with `master` at the base.
- The planned DOM baseline comparison of `main.chant-editor` in fixed states
  (idle, clef selected, clef transaction, division selected, accidental
  selected, placing), with temporary, uncommitted capture tooling.

## Delivery

One PR against `master`. Do not merge. Do not begin M4B-3b.
