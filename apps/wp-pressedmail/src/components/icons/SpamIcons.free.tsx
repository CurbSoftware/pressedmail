/**
 * Free edition: spam checks are Pro, so the icon renders nothing and carries
 * no path data.
 */
import { forwardRef, type SVGProps } from "react";

export type SpamIconMark =
  | "none"
  | "check"
  | "list"
  | "warn"
  | "cross"
  | "alert"
  | "spinner";

export const SPAM_BAG_PATH = "";

export const SpamCheckIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function SpamCheckIcon() {
    return null;
  },
);

export const SpamBagIcon = forwardRef<
  SVGSVGElement,
  SVGProps<SVGSVGElement> & { mark?: SpamIconMark }
>(function SpamBagIcon() {
  return null;
});
