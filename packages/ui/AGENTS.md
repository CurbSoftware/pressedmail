# @kit/ui

<!-- pressedmail-test-runner-policy -->

PressedMail WP unit tests and heavy website/plugin builds follow the required
[capped SSH runner policy](../../docs/operations/PRESSEDMAIL-TEST-VM.md). Use routed tests first, then capped build jobs when needed. The full release verification matrix runs on the capped verify VM, and Docker-based audit cells, PMQA lab runs and dashboard database tests on the capped docker VM.
Missing runner setup must stop a job rather than move it onto the host.
VM setup uses focused checks; full suites and release gates need a separate task.

- Import as `@kit/ui/<name>`. Only the subpaths in `package.json` `exports` resolve. Some files under `src/makerkit` (dropzone) are not exported.
- `@kit/ui/plugin` is the PressedMail plugin's component set. Add plugin-only components there, not to the web exports.
- `packages/ui/dist` is committed `.d.ts` and CSS output for the design-sync tooling (`.design-sync/NOTES.md`). No app build reads it. Restore it from git rather than regenerating it unless `@kit/ui` source changed.
- Merge classes with `cn` from `@kit/ui/utils`. Use semantic Tailwind 4 tokens (`bg-background`, `text-muted-foreground`, `border-border`), not hardcoded light-only colours.
- Forms: React Hook Form with a Zod resolver and no redundant `useForm` generics, `useWatch()` over `watch()`, errors via `FormMessage`, and feedback via `toast` from `@kit/ui/sonner`.
- Icons from `lucide-react`. Icon-only controls need accessible names, and focus states must stay visible.
- Keep product logic in the owning app, not in shared components.
