import { useEffect, useRef, useState, type ReactNode } from "react";
import { __ } from "@wordpress/i18n";

import { Button, Input } from "@kit/ui/plugin";

interface SavedPasswordFieldProps {
  /** Id of the field, so its label still points at what is on screen. */
  id: string;
  /** Editing an account that already has a saved password. */
  editing: boolean;
  /** The form already holds a typed password, so show the real input. */
  hasValue: boolean;
  /** The field failed validation. The message must sit by an input a person can type in, not by "Saved". */
  hasError?: boolean;
  /** The real password input. */
  children: ReactNode;
}

/**
 * An edit form starts with an empty password and the server replaces the saved
 * one on any non-empty value, so a browser filling the box would overwrite it
 * silently. Show "Saved" instead and mount the real input only on request.
 */
export function SavedPasswordField({
  id,
  editing,
  hasValue,
  hasError = false,
  children,
}: SavedPasswordFieldProps) {
  const [changing, setChanging] = useState(hasValue);
  const input = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  // The button that was clicked is gone, so hand focus to the new input.
  useEffect(() => {
    if (changing && asked.current) {
      input.current?.querySelector("input")?.focus();
    }
  }, [changing]);

  if (!editing || changing || hasError) {
    return <div ref={input}>{children}</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        data-test={`${id}-saved`}
        autoComplete="off"
        value={__("Saved", "pressedmail")}
        disabled
        readOnly
        className="bg-muted"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-test={`${id}-change`}
        onClick={() => {
          asked.current = true;
          setChanging(true);
        }}>
        {__("Change password", "pressedmail")}
      </Button>
    </div>
  );
}
