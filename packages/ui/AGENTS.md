# @kit/ui

- Import as `@kit/ui/<name>`. Only the subpaths in `package.json` `exports` resolve. Some files under `src/makerkit` (dropzone, multi-step-form, rich-text-editor) are not exported.
- `@kit/ui/plugin` is the PressedMail plugin's component set. Add plugin-only components there, not to the web exports.
- `packages/ui/dist` is stale committed `.d.ts` output that nothing reads or rebuilds. Ignore it.
- Merge classes with `cn` from `@kit/ui/utils`. Use semantic Tailwind 4 tokens (`bg-background`, `text-muted-foreground`, `border-border`), not hardcoded light-only colours.
- Forms: React Hook Form with a Zod resolver and no redundant `useForm` generics, `useWatch()` over `watch()`, errors via `FormMessage`, and feedback via `toast` from `@kit/ui/sonner`.
- Icons from `lucide-react`. Icon-only controls need accessible names, and focus states must stay visible.
- Keep product logic in the owning app, not in shared components.
