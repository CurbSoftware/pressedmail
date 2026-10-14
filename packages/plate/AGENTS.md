# @kit/plate

<!-- pressedmail-test-runner-policy -->

PressedMail WP unit tests and heavy website/plugin builds follow the required
[capped SSH runner policy](../../docs/operations/PRESSEDMAIL-TEST-VM.md). Use routed tests first, then capped build jobs when needed. The full release verification matrix runs on the capped verify VM, and Docker-based audit cells, PMQA lab runs and dashboard database tests on the capped docker VM.
Missing runner setup must stop a job rather than move it onto the host.
VM setup uses focused checks; full suites and release gates need a separate task.

The only entry point to Plate. Apps import `@kit/plate`, `@kit/plate/react`, `@kit/plate/static` or a plugin subpath (`@kit/plate/<plugin>`, `@kit/plate/<plugin>/react`), never `platejs` or `@platejs/*`. Versions are pinned in the `pnpm-workspace.yaml` catalog so they move together.

Adding an upstream plugin:

1. Add it to the catalog and to this package's dependencies.
2. Add `src/plugins/<name>.ts` (and `<name>-react.ts` if needed).
3. Add the subpath to `exports`.
4. Update `src/plugins/imports.test.ts`.
