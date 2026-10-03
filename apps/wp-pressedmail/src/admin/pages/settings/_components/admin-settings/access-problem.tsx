import type { ComponentProps, ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@kit/ui/plugin";

/**
 * The destructive colour as text on its own 5% tint, pulled a quarter of the way
 * to the foreground like every other status colour on this page, so it clears AA
 * with room to spare in every palette and both modes (access-contrast.test.ts).
 */
const PROBLEM_TEXT =
  "text-[color-mix(in_oklab,var(--pm-destructive-text,var(--destructive))_75%,var(--foreground))] *:data-[slot=alert-description]:text-[color-mix(in_oklab,var(--pm-destructive-text,var(--destructive))_75%,var(--foreground))]";

interface AccessProblemProps
  extends Omit<ComponentProps<typeof Alert>, "title" | "children"> {
  /** What went wrong, in a line. Optional: a refused save leads with its own sentence. */
  title?: ReactNode;
  /** Classes for the body, where it holds a button beside its sentence or under it. */
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Something on the Access Control page went wrong: a list that would not load,
 * a save that was refused. One look for all of them, so a failure reads as a
 * failure and not as a stray line of red text: an icon, a tinted ground and a
 * border in the same family as the pending-change notice on the Roles tab. The
 * icon is a shape as well as a colour, for anyone who cannot tell the red apart.
 *
 * A plain template string, not cn(): a call at the top of a module is a side
 * effect a bundler cannot prove away, and it would keep this Pro-only module in
 * the Free build.
 */
export function AccessProblem({
  title,
  contentClassName,
  children,
  className,
  ...props
}: AccessProblemProps) {
  return (
    <Alert
      variant="destructive"
      className={`border-destructive/30 bg-destructive/5 ${PROBLEM_TEXT}${
        className ? ` ${className}` : ""
      }`}
      {...props}>
      <TriangleAlert aria-hidden="true" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription
        className={`col-start-2${contentClassName ? ` ${contentClassName}` : ""}`}>
        {children}
      </AlertDescription>
    </Alert>
  );
}
