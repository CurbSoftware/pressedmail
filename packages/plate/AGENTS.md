# @kit/plate

The only entry point to Plate. Apps import `@kit/plate`, `@kit/plate/react`, `@kit/plate/static` or a plugin subpath (`@kit/plate/<plugin>`, `@kit/plate/<plugin>/react`), never `platejs` or `@platejs/*`. Versions are pinned in the `pnpm-workspace.yaml` catalog so they move together.

Adding an upstream plugin:

1. Add it to the catalog and to this package's dependencies.
2. Add `src/plugins/<name>.ts` (and `<name>-react.ts` if needed).
3. Add the subpath to `exports`.
4. Update `src/plugins/imports.test.ts`.
