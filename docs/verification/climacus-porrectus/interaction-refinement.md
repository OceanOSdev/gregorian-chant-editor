# Focused interaction refinement

Approved design record. These refinements are now implemented; see
[implementation verification](implementation.md). The original reasoning and
standalone specimens below are retained for comparison. ADR 0007 was Proposed at this review; it is now Accepted.

- [Small selection/focus SVG sheet](interaction-details.svg)
- [Standalone interactive keyboard/pointer specimen](interaction-demo.html)
- [Browser-rendered sheet](interaction-review.png)
- [Updated complete recipes](specimen-recipes.json)
- [Interaction browser results](interaction-browser-results.json)

Open the HTML file in a browser. Tab from its initial button through each group
of three notes, then press Enter or Space to select. Blue indicates keyboard
focus; red follows the selected note's approved contour. Pointer clicks change
selection without forcing a keyboard focus ring. This is a standalone review
specimen with no editor application imports and no editing/history behavior.
The SVG shows the proposed states without requiring interaction.

## Fixed Porrectus first-target top

Replace the former `L=min(−14,T−6)` with **L=−14**, independent of final pitch.
The full first-note rectangle is now:

```text
x = −6
y = −14
width = z + 6
height = max(q+6, u+15) + 14
```

Here `u=12a`, `v=12(a−b)`, `z=W−12`, and q is the approved queue-tip rule.
The bottom edge is exactly unchanged. Notes 2 and 3 keep their complete original
recipes, including their common x=z boundary and pitch-midpoint y partition.

| Interval pair | Old top | New top | Bottom | New rectangle (x,y,width,height) |
| ------------- | ------: | ------: | -----: | -------------------------------- |
| (1,3)         |     −36 |     −14 |     33 | (−6,−14,28,47)                   |
| (2,4)         |     −36 |     −14 |     39 | (−6,−14,36,53)                   |

Each case removes 22 units of unnecessary vertical click padding. No black ink
or selection contour changes. The SVG shows the removed area in dashed gray,
the smaller first target, and the unaffected third-note focus region.

Coverage follows directly from the approved curve recipe. For positive a,
`u≥12`: the left ribbon's upper cubic has y controls −8, 8, u−12, u−5, all
at or below the screen coordinate y=−8. Its lower cubic has y controls u+7,
u+4, 16, 6, all positive. The queue ends at positive q. Thus the left body
never rises above −8; a top of −14 retains six units of padding for every
valid interval, including project extrapolations. The final terminal stays in
x≥z and does not require extra left-target height. Target interiors remain
disjoint across x=z; exact shared boundaries retain later-note ownership.

## Chosen focus behavior: follow the pointer target contour

Use **polygonal focus for path targets**, and retain rectangular focus for
rectangular targets. This corrects the original proposal's claim that a path
replacement would leave rectangular focus feedback unchanged. The current
`.score__note:focus-visible .score__note-hit-target` selector styles the target
itself; the chosen behavior deliberately preserves that relationship.

- Keep the current blue 15% fill, #1e64d2 stroke, three CSS-pixel width, and
  non-scaling stroke. The clipped padded polygon highlights the area that
  actually owns pointer input, rather than an overlapping bounding rectangle.
- Keep selected-note feedback separate: the current red stroke follows the
  approved black head, diamond or ribbon selection contour. Focus alone does
  not select; changing selection does not silently change the semantic focus
  identity. The specimen shows selection-only, focus-only and both together,
  with native and 0.55× examples.
- Keep `hitBounds` as the bounding box of the optional hit path for derived
  measurements. It is **not** a separately painted keyboard-focus rectangle.
  No additional focus field, shape or renderer abstraction is needed.
- For the new target shapes, explicitly use `pointer-events: fill`. SVG
  transparent fill still receives pointer input. The focus stroke is decorative
  outside that fill, so its three-pixel width cannot enlarge ownership or steal
  adjacent-note clicks. Existing engraved kinds retain their current targets
  and styling; this rule can be scoped to the two new kinds during implementation.

The concrete future rendering contract is still one accessible parent group per
semantic note: existing `role="button"`, accessible name, tabindex, pressed and
disabled states, ID and event handlers. The actual target child is
`aria-hidden="true"`, nonfocusable, and has no role, accessible name or tabindex.
An aria-hidden wrapper is equally suitable if using the current minimal
`InkShapeView` interface. Decorative selection paths are also hidden and
`pointer-events="none"`. Neither an optional target path nor its focus styling
introduces another accessible control. Keep the existing placement-mode disabled
state and keyboard/whole-neume descriptions in the actual editor; the standalone
specimen explicitly describes only the interactions it implements.

## Verification

The regenerated 20-case recipe set was compared with the prior review: all
black ink paths, selection paths, nominal anchors, painted bounds, lyric
anchors, advances and Climacus hit polygons are identical. For Porrectus,
only note 1's rectangle top/height changed; its bottom and the other targets
are identical. Wider Climacus spacing plateaus remain project-specific optical
decisions, not independently verified GregorioTeX layout rules.

Chromium checks of the static proposals again found zero declared-vs-actual
painted-bounds error across all 20 silhouettes, zero uncovered sampled painted
points, and zero wrong-note Climacus samples. The existing finite sampling
qualification still applies. The fixed-top coverage argument above covers all
positive semantic intervals without requiring an exhaustive interval cutoff.

The interactive specimen was checked with real browser Tab and Enter input.
The middle Climacus note received `:focus-visible`, a blue path focus indicator
and its unchanged accessible name; Enter added the red selected-note contour.
Computed pointer ownership remained `fill`. The accessibility tree contained
exactly nine named note buttons for the three examples and no extra target
buttons. The removed whitespace point (6,−25) owned no note control in both
(1,3) and (2,4). The result file records these observations. These verify the
standalone specimen, not an unimplemented editor change.

Repository checks passed: formatting, lint, all 501 tests in 31 files, and the
production build. No application interaction check is inferred from those
results or from this standalone specimen.

No further silhouette or architecture decision is needed. This focused review
asks only for acceptance of the fixed target top and the illustrated polygonal
focus behavior before application implementation.
