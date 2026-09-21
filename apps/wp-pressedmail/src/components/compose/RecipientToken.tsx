/**
 * RecipientToken Component
 *
 * Displays a selected recipient as a token/chip in the recipient input.
 * Shows contact name, email, or list with appropriate styling.
 *
 * @since 1.3.0
 */

import React from "react";
import { __, sprintf, _n } from "@wordpress/i18n";
import { X, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecipientTokenProps } from "@/types/recipients";
import {
  isValidImageUrl,
  getRecipientInitials,
  getRecipientAvatarColor,
} from "@/types/recipients";

export const RecipientToken: React.FC<RecipientTokenProps> = ({
  recipient,
  onRemove,
  selected = false,
  disabled = false,
}) => {
  const isContact = recipient.type === "contact";
  const isList = recipient.type === "list";

  const initials = getRecipientInitials(recipient.displayName);
  const avatarColor = getRecipientAvatarColor(recipient.displayName);
  const hasValidAvatar = isValidImageUrl(recipient.avatarUrl);
  // The chip shows the name only; two contacts called "Rob" would be
  // indistinguishable without the address, so assistive tech always gets it.
  const hiddenAddress =
    !isList && recipient.email && recipient.email !== recipient.displayName
      ? recipient.email
      : "";

  return (
    <div
      data-test={`recipient-token-${recipient.id}`}
      className={cn(
        "inline-flex items-center gap-1 max-w-50 rounded-full border px-1.5 py-0.5 text-sm transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-foreground",
        isList &&
          "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
      title={
        isList
          ? sprintf(
              /* translators: 1: list name, 2: number of people in the list. */
              _n(
                "%1$s (%2$d member)",
                "%1$s (%2$d members)",
                recipient.memberCount ?? 0,
                "pressedmail",
              ),
              recipient.displayName,
              recipient.memberCount ?? 0,
            )
          : recipient.email
      }>
      {/* Avatar or icon */}
      {isList ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
          <Users className="h-3 w-3 text-purple-600 dark:text-purple-400" />
        </span>
      ) : hasValidAvatar ? (
        <img
          src={recipient.avatarUrl!}
          alt=""
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : isContact ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white",
            avatarColor,
          )}>
          {initials}
        </span>
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
          <User className="h-3 w-3 text-muted-foreground" />
        </span>
      )}

      {/* Display name */}
      <span className="truncate text-xs font-medium">
        {recipient.displayName}
      </span>
      {/* Parentheses, not angle brackets: screen readers say "less" and
          "greater" for those. */}
      {hiddenAddress && <span className="sr-only">{` (${hiddenAddress})`}</span>}

      {/* Member count for lists */}
      {isList && recipient.memberCount !== undefined && (
        <span className="text-[10px] text-purple-600 dark:text-purple-400">
          ({recipient.memberCount})
        </span>
      )}

      {/* Remove button */}
      {!disabled && (
        <button
          type="button"
          data-test={`remove-recipient-${recipient.id}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
            "hover:bg-destructive/20 hover:text-destructive",
          )}
          aria-label={
            hiddenAddress
              ? sprintf(
                  /* translators: 1: recipient name, 2: their email address. */
                  __("Remove %1$s (%2$s)", "pressedmail"),
                  recipient.displayName,
                  hiddenAddress,
                )
              : sprintf(
                  /* translators: %s: recipient name or email address. */
                  __("Remove %s", "pressedmail"),
                  recipient.displayName,
                )
          }>
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default RecipientToken;
