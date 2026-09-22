"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Search, X } from "lucide-react";

import { Button, Input } from "@kit/ui/plugin";

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
 * The one phone search field: the shared `Input` (which already carries the
 * 44px touch floor) with a leading icon column and an optional clear button.
 * Both are padded for, so neither overlaps the placeholder or typed text.
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
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        autoComplete="off"
        id={inputId}
        ref={inputRef}
        type="search"
        role={role}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("pl-10", showClear && "pr-10")}
      />
      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={__("Clear search", "pressedmail")}
          onClick={onClear}
          className="pm-no-tap-highlight absolute right-1 top-1/2 -translate-y-1/2 after:absolute after:-inset-2 after:content-['']">
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export default MobileSearchInput;
