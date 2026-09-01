# @kit/plate

Central Plate editor package for the monorepo.

## Task Scope

- Follow the root `AGENTS.md` first; this file adds only scope-specific rules.
- Complete the current request and approved plan with the smallest appropriate change.
- Do not expand into unrelated refactors, cleanup, documentation, tests, release work, or repository-wide investigation.
- Run only focused validation that directly proves the touched behavior. Full suites and release gates are optional unless explicitly requested.
- Stop when the requested work is complete and report any blocker instead of pursuing unrelated workarounds.

## Import and Version Rules

- Import Plate only through `@kit/plate` or its exported subpaths.
- Do not import directly from `platejs` or `@platejs/*` inside apps.
- Core subpaths include `@kit/plate`, `@kit/plate/react`, and `@kit/plate/static`.
- Curated subpaths include `@kit/plate/editor-base-kit` and `@kit/plate/transforms`.
- Versions are pinned through the workspace catalog so consumers upgrade together.

## Adding a Plate Plugin

When the task specifically adds a new upstream plugin:

1. Add or update the catalog dependency.
2. Add the package dependency.
3. Add the corresponding `src/plugins/<name>.ts` export.
4. Update the package `exports` map.
5. Add or update the focused import-contract coverage when useful.

Do not refactor editor internals during an unrelated app task. Run only the focused import, type, or unit check needed for the requested change.
