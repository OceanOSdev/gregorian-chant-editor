# Repository Guidelines

## Project Goal

This repository contains a browser-based graphical editor for four-line Gregorian chant notation, built with React, TypeScript, Vite, and SVG.

The initial notation profile is modern square notation. Do not attempt to support every historical or regional notation tradition unless explicitly requested.

## Project Structure and Module Organization

This repository is a React 19 application built with TypeScript and Vite.

Application entry points and global files live directly under `src/`:

* `main.tsx` mounts the application.
* `App.tsx` contains the root application component.
* `App.css` and `index.css` contain application and global styles.

Imported images belong in `src/assets/`. Files that must retain stable public URLs belong in `public/`.

Build, lint, Vite, and TypeScript configuration files live at the repository root.

Organize chant-editor code by architectural responsibility:

```text
src/
├── app/
├── editor/
│   ├── components/
│   ├── domain/
│   ├── commands/
│   ├── interaction/
│   ├── layout/
│   ├── persistence/
│   ├── rendering/
│   └── state/
└── shared/
```

Do not create a general-purpose `src/components/` folder for editor-specific components. Place components under the feature or architectural area that owns them.

Co-locate component-specific styles and tests with the component when practical.

Not every directory above must exist immediately. Add directories only when the current milestone requires them.

## Documentation Map

Read the guide that owns a subsystem before changing its documented contract:

* [Architecture](docs/architecture.md)
* [Domain model](docs/domain-model.md)
* [Layout and rendering](docs/layout-and-rendering.md)
* [Editor interactions](docs/editor-interactions.md)
* [Commands and history](docs/commands-and-history.md)
* [Testing](docs/testing.md)
* [Glossary](docs/glossary.md)
* [Roadmap and limitations](docs/roadmap.md)
* Architecture decisions:
  [state separation](docs/decisions/001-separate-semantic-and-derived-state.md),
  [stable identities](docs/decisions/002-stable-semantic-identities.md),
  [explicit neume types](docs/decisions/003-explicit-neume-types.md), and
  [geometry-derived wrapping](docs/decisions/004-derive-wrapping-from-rendered-geometry.md)

When a documented contract changes, update its owning guide in the same
change. When a durable architectural decision changes, update the relevant ADR
or explicitly review whether a new decision record is warranted. Keep the
guides linked and avoid copying one authoritative explanation into several
files. Use the [testing guide](docs/testing.md) for test seams and manual
verification responsibilities.

## Architectural Boundaries

Keep these concerns separate:

1. Semantic chant document
2. Editing commands and state transitions
3. Layout and engraving
4. SVG rendering
5. User interaction
6. Persistence and interchange

The semantic chant document describes what the chant is. It must not contain pixel coordinates or depend on React, SVG, the DOM, or browser APIs.

The layout engine consumes a semantic chant document and produces positioned layout data. Prefer pure TypeScript functions for layout calculations.

React components render layout data and coordinate the user interface. Do not make the React component tree the canonical score representation.

The SVG rendering layer must not contain authoritative musical state. Rendered elements should refer back to semantic entities through stable IDs.

Keep transient pointer state, such as an in-progress drag position, separate from persistent document state.

## Build, Test, and Development Commands

* `npm install` installs the dependency versions recorded in `package-lock.json`.
* `npm run dev` starts the Vite development server with hot module replacement.
* `npm run build` runs TypeScript project checks and creates a production bundle in `dist/`.
* `npm run lint` checks source files with Oxlint.
* `npm run preview` serves the production build locally for a final smoke test.
* `npm test` runs the Vitest suite once.
* `npm run test:watch` runs Vitest in watch mode.

Run `npm test`, `npm run lint`, and `npm run build` before completing a coding task.

When automated tests exist, run the relevant tests as well.

## Coding Style and Naming Conventions

Follow the existing TypeScript and TSX style:

* Two-space indentation
* Single quotes
* No semicolons
* PascalCase for React components and their files
* camelCase for functions and variables
* Descriptive kebab-case names for static assets

Use function components and React hooks.

Prefer named exports for project modules unless a framework convention gives a clear reason to use a default export.

Keep imports grouped at the top of each file.

Use `className` for CSS hooks.

Provide accessible names for interactive controls and meaningful visual elements.

Use strict TypeScript. Do not use `any`, non-null assertions, ignored errors, or disabled checks without a documented reason.

Prefer plain TypeScript modules for semantic models, commands, parsing, validation, and layout logic.

Prefer small, focused functions and components over premature abstractions.

Do not add a dependency unless it provides clear value for the current milestone. Explain significant new dependencies when introducing them.

Do not mutate application state directly.

## Domain Modeling Guidelines

Give an object a stable ID when it must retain identity while being selected, moved, reordered, referenced, or edited.

Do not add IDs to value objects merely because they are represented by an interface.

Use interfaces for named record-like domain objects when appropriate.

Use type aliases for unions, primitive aliases, tuples, mapped types, and other type-level compositions.

Represent note height using a discrete staff-relative position in the semantic model, not a rendered pixel coordinate.

Persisted document formats must include a schema version.

The internal semantic document should initially be the canonical representation. External formats such as GABC or MEI should be handled through import and export adapters.

## Scope Control

Implement only the requested milestone.

Do not add the following unless explicitly requested:

* Authentication
* A backend
* Cloud storage
* Collaboration
* Audio or MIDI playback
* PDF export
* Every Gregorian neume
* Every historical notation tradition
* Manual system breaks, pagination, or alternate wrapping policies beyond the
  current measured whole-neume wrapping
* Complex state-management libraries
* A broad UI component library

Prefer completing one small vertical slice over scaffolding many unfinished systems.

## Testing Guidelines

Vitest is configured for plain TypeScript unit tests. No browser environment,
component testing library, or coverage requirement is currently configured.

For current changes:

1. Run `npm test`.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Verify the relevant behavior manually with `npm run dev`.

* Use names such as `layoutChant.test.ts` or `ChantEditor.test.tsx`.
* Prioritize tests for domain transformations, editing commands, parsers, serializers, and layout logic.
* Use browser-level tests for important editor interactions.

Do not rely exclusively on React component tests for logic that can be tested as plain TypeScript.

## Commit and Pull Request Guidelines

Use concise Conventional Commit-style subjects:

* `feat: render initial chant staff`
* `fix: preserve editor selection`
* `docs: describe semantic document model`
* `refactor: separate layout from rendering`
* `test: cover note movement command`

Keep unrelated changes in separate commits.

When pull requests become available, they should:

* Explain the user-visible or architectural change.
* List the verification performed.
* Link relevant issues.
* Include screenshots or short recordings for meaningful UI changes.

## Completion Requirements

Before completing a coding task:

1. Review the changed files for unnecessary scope expansion.
2. Run the linter.
3. Run the production build.
4. Run relevant automated tests when available.
5. Verify significant UI behavior manually when practical.
6. Summarize the changed files.
7. Explain any architectural decisions or remaining limitations.

Do not claim that verification passed unless the corresponding command was actually run successfully.
