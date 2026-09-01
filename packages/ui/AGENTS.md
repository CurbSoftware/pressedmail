# UI Components and Styling

Scoped guidance for `@kit/ui` and consumers of the shared UI package.

## Task Scope

- Follow the root `AGENTS.md` first; this file adds only scope-specific rules.
- Complete the current request and approved plan with the smallest appropriate change.
- Do not expand into unrelated refactors, cleanup, documentation, tests, release work, or repository-wide investigation.
- Run only focused validation that directly proves the touched behavior. Full suites and release gates are optional unless explicitly requested.
- Stop when the requested work is complete and report any blocker instead of pursuing unrelated workarounds.

## Imports and Styling

- Import shared components as `@kit/ui/<component>` regardless of their internal folder.
- Use Tailwind CSS 4 semantic tokens such as `bg-background`, `text-foreground`, `text-muted-foreground`, and `border-border`.
- Merge classes with `cn()` from `@kit/ui/utils`.
- Avoid hardcoded light-only colors when semantic tokens exist.
- Use `lucide-react` icons where available.

```tsx
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

<Button className={cn('w-full', className)}>Save</Button>
```

## Forms

- Use React Hook Form with a reusable Zod schema.
- Let the Zod resolver infer types; do not add unnecessary `useForm` generics.
- Use `useWatch()` instead of `watch()`.
- Show validation errors with `FormMessage`.
- Use `toast` from `@kit/ui/sonner` for user-facing mutation feedback.

## Components and State

- Use `If` from `@kit/ui/if` for typed conditional rendering when it improves clarity.
- Provide clear pending, empty, error, and success states.
- Add `data-testid` only when a focused test needs a stable selector.
- Keep route-specific composition in the owning app rather than growing generic UI components with product logic.

## Accessibility

- Use semantic HTML.
- Preserve keyboard navigation and visible focus states.
- Add accessible names to icon-only controls.
- Associate descriptions and errors with form controls.

Run only the focused component, lint, or type check needed for the requested change.
