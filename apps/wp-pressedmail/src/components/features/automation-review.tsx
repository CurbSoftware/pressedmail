import { __ } from "@wordpress/i18n";

import { Button } from "@kit/ui/plugin";

/**
 * An administrator's answer to paused automatic work, given from inside the
 * app: this site carries on, or it is a copy and stays paused.
 *
 * A real form POST, because the server answers with a redirect back to the
 * page. PHP sends `automationReview` to administrators only. Without it the
 * older review link is shown, and a non-administrator gets nothing.
 */
export function AutomationReviewActions() {
  const runtime =
    typeof window === "undefined" ? undefined : window.pressedmailPlugin;
  const review = runtime?.automationReview;

  if (
    review &&
    typeof review.url === "string" &&
    review.url !== "" &&
    typeof review.action === "string" &&
    typeof review.nonce === "string"
  ) {
    return (
      <form
        method="post"
        action={review.url}
        data-test="automation-review-form"
        data-testid="automation-review-form"
        className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
        <input type="hidden" name="action" value={review.action} />
        <input type="hidden" name="_wpnonce" value={review.nonce} />
        <Button
          type="submit"
          name="decision"
          value="resume"
          size="sm"
          className="h-auto min-h-7 max-w-full shrink px-2 py-1 text-start text-xs whitespace-normal">
          {__("Use this site: resume automatic work", "pressedmail")}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="pause"
          variant="outline"
          size="sm"
          className="h-auto min-h-7 max-w-full shrink px-2 py-1 text-start text-xs whitespace-normal">
          {__("This is a copy: keep paused", "pressedmail")}
        </Button>
      </form>
    );
  }

  const reviewUrl =
    typeof runtime?.automationReviewUrl === "string"
      ? runtime.automationReviewUrl
      : "";
  if (!reviewUrl) return null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs">
      <a href={reviewUrl} data-test="automation-paused-review">
        {__("Review", "pressedmail")}
      </a>
    </Button>
  );
}
