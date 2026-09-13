"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MobileSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible label, rendered sr-only and associated with the input. */
  label: string;
  placeholder?: string;
  /** When provided, a clear (X) button shows while there is a value. */
  onClear?: () => void;
  id?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Marks the field as a search landmark control for assistive tech. */
  role?: "searchbox";
}

/**
 * Shared phone-shell search field. A fixed leading icon slot plus padded input
 * means the icon never overlaps the placeholder or typed text (the recurring
 * mobile bug), and the optional trailing clear button reserves its own column.
 * Reuses theme tokens only, no bespoke styling.
 */
export function MobileSearchInput({
  value,
  onChange,
  label,
  placeholder,
  onClear,
  id,
  autoFocus,
  inputRef,
  className,
  role,
}: MobileSearchInputProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const showClear = Boolean(onClear) && value.length > 0;

  return (
    <div className={cn("relative", className)}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        autoComplete="off"
        id={inputId}
        ref={inputRef}
        type="search"
        role={role}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "h-11 w-full rounded-full border border-border bg-card pl-10 text-sm leading-none outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
          showClear ? "pr-10" : "pr-4",
        )}
      />
      {showClear ? (
        <button
          type="button"
          aria-label={__("Clear search", "pressedmail")}
          onClick={onClear}
          className={cn(
            "pm-no-tap-highlight absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-muted",
            // Visually a 28px circle, but a thumb gets the full 44px: the
            // pseudo-element grows the target without growing the field.
            "after:absolute after:-inset-2 after:content-['']",
          )}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export default MobileSearchInput;
