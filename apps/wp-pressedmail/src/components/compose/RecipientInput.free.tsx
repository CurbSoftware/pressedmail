import { useState, type KeyboardEvent } from "react";
import { __ } from "@wordpress/i18n";

import { RecipientToken } from "./RecipientToken";
import { cn } from "@/lib/utils";
import type { RecipientInputProps } from "@/types/recipients";
import {
  dedupeRecipientsByEmail,
  getRecipientEmailKey,
  parseEmailString,
} from "@/types/recipients";

export function RecipientInput({
  label,
  value,
  dedupeRecipients = [],
  onChange,
  placeholder = __("Enter an email address", "pressedmail"),
  disabled = false,
  className,
  autoFocus = false,
  trailingActions,
}: RecipientInputProps) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const parsed = parseEmailString(draft);
    if (parsed.length === 0) return;

    const reserved = new Set(
      dedupeRecipients
        .map(getRecipientEmailKey)
        .filter((email): email is string => Boolean(email)),
    );
    onChange(dedupeRecipientsByEmail([...value, ...parsed], reserved));
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";"].includes(event.key)) {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-md bg-background",
        disabled && "opacity-60",
        className,
      )}
      data-test="recipient-input">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {value.map((recipient) => (
          <RecipientToken
            key={recipient.id}
            recipient={recipient}
            disabled={disabled}
            onRemove={() =>
              onChange(value.filter((item) => item.id !== recipient.id))
            }
          />
        ))}
        <input autoComplete="off"
          type="text"
          className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label={label}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : undefined}
          value={draft}
          onBlur={commitDraft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {trailingActions ? (
        <div className="flex shrink-0 items-center gap-1">
          {trailingActions}
        </div>
      ) : null}
    </div>
  );
}

export default RecipientInput;
