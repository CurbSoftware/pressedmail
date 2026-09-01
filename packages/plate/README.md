# @kit/plate

Centralized Plate editor framework package for PMCPPN.

## Purpose

Single source of truth for Plate (`platejs` and `@platejs/*`) versioning across
the monorepo. Wraps the catalog-pinned upstream packages and exposes curated
plugin presets and editor kits consumed by the dashboard, the product
websites, and the WordPress plugins.

## Consumers

- `apps/dashboard`: CMS / content editing
- `apps/web-pressedmail`, `apps/web-curbpress`, `apps/web-pressednotes`: marketing / blog
- `apps/wp-pressedmail`: standalone email composer application
- `wordpress/packages/pressednotes`: note editor feature packages

## Import convention

Always import Plate from `@kit/plate`, never from `platejs` or `@platejs/*`
directly inside apps. The package subpaths mirror the upstream layout:

```ts
// core framework
import { KEYS, createSlateEditor } from '@kit/plate';
import { Plate, PlateContent, useEditorRef } from '@kit/plate/react';
import { SlateElement, serializeHtml } from '@kit/plate/static';

// per-plugin
import { ParagraphPlugin, HeadingPlugin } from '@kit/plate/basic-nodes';
import { LinkPlugin } from '@kit/plate/link/react';
import { TablePlugin } from '@kit/plate/table/react';

// curated kits
import { BaseEditorKit } from '@kit/plate/editor-base-kit';
import { insertBlock, setBlockType } from '@kit/plate/transforms';
```

## Versioning

Plate versions are pinned in the root `pnpm-workspace.yaml` `catalog:` block.
All consumers read from the catalog via `@kit/plate` so a single catalog bump
upgrades every consumer atomically.

## What lives here vs in apps

| Lives in `@kit/plate`                                | Lives in apps                                       |
| ---------------------------------------------------- | --------------------------------------------------- |
| Re-exports of `platejs` and every `@platejs/*`        | App-specific node components (`*-node.tsx`)         |
| `BaseEditorKit` plugin preset                        | App-specific toolbar buttons and styling            |
| `transforms.ts` shared block ops                     | App-specific custom plugins (signature, quote, ...) |
| Curated kits (autoformat, markdown, composer)        | App page / route integration                        |

## Adding a new `@platejs/*` plugin

1. Add the package version to `pnpm-workspace.yaml` `catalog:`.
2. Add it to `packages/plate/package.json` `dependencies` as `catalog:`.
3. Add `./src/plugins/<name>.ts` (and `<name>-react.ts` if a React variant exists).
4. Wire the new subpath(s) into `packages/plate/package.json` `exports`.
5. Add a `plugins/imports.test.ts` row asserting the new subpath resolves.

## TDD And Verification

- Follow red-green-refactor from
  `testing/README.md`.
- `pnpm --filter @kit/plate test:unit` runs the focused vitest suite.
- `pnpm --filter @kit/plate typecheck` and `pnpm --filter @kit/plate lint`
  must pass before consumer app changes ship.
