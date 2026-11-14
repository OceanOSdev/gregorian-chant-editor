# Checkpoint 9C-2: integrated spacing verification

2026-11-14. Owner authorized 9C-2 after reviewing `88051f6` in draft PR #82.
Final owner visual/implementation acceptance and merge remain separate.

## Review repairs

- The hosted-CI authored-diamond regression used only twelve puncta, which now
  fit in a compact span. It now uses 32: the first system contains 23 diamonds
  versus 26 squares, with measured origin advances 20 versus 18 and unchanged
  head widths 14 versus 12. The test still checks exact system membership and
  the following system's semantic start index. Production spacing is unchanged.
- Layout membership is derived in one forward traversal of the existing
  ready anchor/index map. The last anchor ID is carried through unanchored
  neumes; the lyricless prefix stays undefined. The independent interval oracle,
  readiness/fallback and both-null exclusions remain in force. This is linear
  membership derivation, not a claim that every layout operation is linear.

- Firefox's new dense fallback-reflow check exposed an untracked focused SVG
  note: the document-level bubbling focus event had not recorded its ID. The
  note ref-detach callback now remembers the actual focused control before React
  removes it. Existing restoration still requires a disconnected old element,
  no explicit focus request and body focus; it does not fall back to selection
  or steal focus from another control. Browser verification below determines
  acceptance of this repair.

## Integrated checks

The existing `word-composition` runner driver now calls
[`browser-review.mjs`](browser-review.mjs), using the real editor in its existing
development fixture and native CDP/BiDi input. No new runner or production
fixture API was added. Selected typed [specimens](fixtures.ts) include et/lux,
the supported full perpetua approximation, three supported Kyrie XI fragments,
a long span with an internal division/explicit clef/earlier-written accidental,
and a dense span containing all fourteen kinds and modifier overhangs.

At 1440px and 320px, checks compare actual SVG ink/system membership with
measured layout, independently derive membership/eligible barriers, test both
sides of midpoint clips, and natively select/focus every constituent of all
fourteen kinds. Selection, placement and lyric-move decorations retain clipping.
The long span checks one lyric per anchor, no fabricated internal continuation,
existing genuine next-syllable marks, focus across provisional/dense reparenting,
native pitch editing/undo/redo, slot-based hover without committed reflow,
painted caret/ghost, insertion with stable anchors, persistent placement focus,
and exact native v9 cache decoding. Font loading events are explicitly simulated
to drive the existing fallback/remeasurement path; pointer and keyboard actions
use browser input rather than dispatched DOM key/click events. Palette/move
activation and fixture mounting use DOM APIs, as in the existing driver.

## Results and visual review

Verification is in progress. Actual final runs and retained visual specimens
will be recorded here before checkpoint closeout. No performance benchmark,
full compatibility comparison or comprehensive driver matrix is included.
