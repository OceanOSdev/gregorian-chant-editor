# 18. Constrain mora presence to conventional rhythmic patterns

Date: 2026-11-09

## Status

Accepted (owner-approved 2026-11-09). Supersedes
[ADR 0017](0017-model-rhythmic-modifiers-on-notes.md), whose original decision is
preserved as historical context. ADR 0016 remains Accepted.

## Context

The Porrectus investigation demonstrated that arbitrary per-note dot counts
cannot reliably communicate note ownership in conventional square notation.
In Gregorio, a conventional auctum duplex affects two distinct notes; its `..`
syntax is not two augmentations attached to one note. Software acceptance of
unusual combinations does not establish a clear conventional interpretation.
The owner approved the [conventional-model proposal](../plans/stage-8a-conventional-rhythm-model.md)
after rejecting editorial ownership labels and novel glyphs.

## Decision

1. A stable-ID note may have a single mora presence flag, `mora: 1`, or omit it.
   There is no canonical `mora: 2`, numeric duration or implied playback timing.
   Horizontal episema (`episema: true`) remains independent on every note.
2. Supported mora sets are: Punctum none/sole; Podatus and Clivis
   none/first/second/both; Scandicus, Torculus, Climacus and Porrectus
   none/final/final two. This conservative product profile does not assert that
   every excluded historical use is invalid. New patterns require sourced,
   unambiguous engraving rather than editorial encodings of arbitrary data.
3. Two marked notes in the supported final pair derive a conventional auctum
   duplex. The affected note IDs are authoritative; do not persist a duplicate
   sign object or sign identity. Pair geometry is resolved together with
   line/space and adjacent-interval rules, and participates in shared measured
   ink, spacing and wrapping. Approved neume contours and lyric anchors remain.
4. Contextual neume-scope edits change all affected flags atomically. Episema
   remains a selected-note edit. Selection alone never changes the document or
   score position. Commands reject unsupported patterns without history or
   autosave writes. Movement preserves marks; deletion preserves surviving
   note objects and never retargets marks to a different survivor.
5. Finalize the unmerged native v2 with this narrower model. The arbitrary-count
   v2 from earlier PR commits is a withdrawn development draft, not silently
   reinterpreted data. Preserve exact v1 support and load compatible draft-v2
   documents unchanged. Fully validate old strict syntax before identifying an
   incompatible draft as requiring resolution. Never clamp `2`, move a mark,
   infer a pair or discard unsupported values.
6. Incompatible imports leave the current document intact and offer the original
   file for download. Incompatible cached strings stay untouched under the same
   storage key, block automatic saving and offer an original-source download.
   Current-score Export is separate from source recovery. Explicit confirmed
   cache replacement remains available under existing conflict protections.
   No automatic startup migration or conversion assistant is introduced.

## Consequences

The semantic model remains small and preserves stable note identities, while
finished scores use conventional signs rather than ownership codes. Some
source-specific early-note combinations are deliberately unavailable. Authors
must retain incompatible source data or explicitly revise it in a compatible
editor; this is a documented pre-release compatibility restriction on draft v2,
not complete backward compatibility with every experimental v2 score.

Manual sign positioning, extra rhythmic signs, alternate neume grouping tools,
GABC interchange and performance interpretation remain outside Stage 8A.
