# MVP

> **Historical milestone:** This document records the original first vertical
> slice. It is not the current capability or architecture reference. See the
> [README](../README.md), [architecture overview](architecture.md),
> [domain model](domain-model.md), and
> [layout and rendering](layout-and-rendering.md),
> [editor interactions](editor-interactions.md), and
> [commands and history](commands-and-history.md) for the implemented editor
> today.

## Goal

Build the smallest complete vertical slice of a browser-based Gregorian chant editor.

The first milestone renders a semantic chant document as SVG.

## Initial Screen

The application displays:

* A title
* One four-line staff
* One placeholder C clef
* One punctum
* One lyric syllable

## Architecture

The implementation must maintain this flow:

```text
semantic document → layout data → SVG rendering
```

### Semantic document

The semantic document describes the chant without storing rendered coordinates.

It may contain information such as:

* Document title
* Clef type and staff line
* Lyric syllables
* Notes
* Discrete staff positions

It must not depend on React, SVG, the DOM, or browser APIs.

### Layout

A pure TypeScript layout function converts semantic data into positioned rendering data.

Pixel coordinates belong in layout output, not in the semantic document.

### Rendering

React components render the layout data using SVG.

The SVG component must not be the canonical representation of the score.

## Acceptance Criteria

* The punctum originates from a plain TypeScript document object.
* The note height is represented as a discrete staff-relative position.
* The semantic document contains no pixel coordinates.
* A pure layout function calculates the rendered positions.
* React renders the layout result as SVG.
* The score remains crisp when resized.
* No new runtime dependencies are added.
* `npm run lint` succeeds.
* `npm run build` succeeds.

## Not Included

This milestone does not include:

* Selection
* Editing
* Dragging
* Keyboard controls
* Multiple neume types
* Automatic line wrapping
* Undo or redo
* Persistence
* GABC import or export
* Redux or another external state-management library
* A backend
* Authentication
