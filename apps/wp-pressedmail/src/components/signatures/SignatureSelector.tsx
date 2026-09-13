/**
 * Signature Selector Component
 *
 * Dropdown selector for selecting signatures in the composer.
 *
 * @since 1.1.0
 */

import React, { useState, useMemo } from "react";
import { __ } from "@wordpress/i18n";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "@kit/ui/plugin";
import { PenTool, ChevronDown, Star, Settings, Check } from "lucide-react";
import { useSignatures, useAccountSignatures } from "../../context/signatures";
import type { Signature, SignatureInsertContext } from "../../types/signatures";
import { cn } from "../../lib/utils";
import { sanitizePreviewHtml } from "../../lib/sanitize-email";

interface SignatureSelectorProps {
  /** Currently selected signature ID */
  value?: number | null;
  /** Callback when signature is selected */
  onSelect: (signature: Signature | null) => void;
  /** Account ID to filter signatures */
  accountId?: number | null;
  /** Placeholder text. Defaults to a translated "Select signature". */
  placeholder?: string;
  /** Whether selector is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Context for filtering (new, reply, forward) */
  context?: SignatureInsertContext;
  /** Show settings link */
  showSettingsLink?: boolean;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
}

export const SignatureSelector: React.FC<SignatureSelectorProps> = ({
  value,
  onSelect,
  accountId = null,
  placeholder,
  disabled = false,
  className,
  context,
  showSettingsLink = false,
  onSettingsClick,
}) => {
  const { loading } = useSignatures();
  const signatures = useAccountSignatures(accountId);
  const [open, setOpen] = useState(false);
  const placeholderLabel = placeholder ?? __("Select signature", "pressedmail");

  // Filter signatures based on context
  const filteredSignatures = useMemo(() => {
    if (!context) return signatures;

    return signatures.filter((sig) => {
      switch (context) {
        case "new":
          return sig.include_for_new;
        case "reply":
          return sig.include_for_reply;
        case "forward":
          return sig.include_for_forward;
        default:
          return true;
      }
    });
  }, [signatures, context]);

  const selectedSignature = useMemo(() => {
    return signatures.find((sig) => sig.id === value) ?? null;
  }, [signatures, value]);

  const handleSelect = (signature: Signature | null) => {
    onSelect(signature);
    setOpen(false);
  };

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md",
          "text-sm border border-input",
          "bg-muted",
          "opacity-50 cursor-not-allowed",
          "w-[200px]",
          className,
        )}>
        <span className="text-muted-foreground">
          {__("Loading...", "pressedmail")}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || filteredSignatures.length === 0}
          className={cn(
            // h-9 pinned deliberately. Its padding alone measures 38px; the
            // popover trigger's old injected h-9 had been clamping it to 36
            // since it was written, so the shipped look is 36. Keeping it
            // avoids a 2px growth in a control that lines up with inputs.
            "inline-flex h-9 items-center justify-between gap-2 px-3 py-2 rounded-md",
            "text-sm border border-input",
            "bg-background",
            "hover:bg-muted",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "w-[200px]",
            className,
          )}>
          <span className="flex items-center gap-2 truncate">
            {selectedSignature ? (
              <>
                <PenTool className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{selectedSignature.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholderLabel}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "z-50 w-[200px] rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
        )}
        sideOffset={5}
        align="start">
        <div className="max-h-64 overflow-y-auto p-1">
          {/* No signature option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left",
              "text-sm transition-colors",
              "hover:bg-muted",
              value === null && "bg-primary/10",
            )}>
            <span className="text-muted-foreground">
              {__("No signature", "pressedmail")}
            </span>
            {value === null && (
              <Check className="ml-auto h-4 w-4 text-primary" />
            )}
          </button>

          {/* Divider */}
          {filteredSignatures.length > 0 && (
            <div className="my-1 h-px bg-border" />
          )}

          {/* Signatures */}
          {filteredSignatures.map((sig) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => handleSelect(sig)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left",
                "text-sm transition-colors",
                "hover:bg-muted",
                value === sig.id && "bg-primary/10",
              )}>
              {sig.is_default && (
                <Star className="h-3 w-3 text-[var(--theme-starred,#f59e0b)] flex-shrink-0" />
              )}
              <span className="truncate">{sig.name}</span>
              {value === sig.id && (
                <Check className="ml-auto h-4 w-4 text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Settings Link */}
        {showSettingsLink && onSettingsClick && (
          <>
            <div className="h-px bg-border" />
            <div className="p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSettingsClick();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md",
                  "text-sm text-muted-foreground",
                  "hover:text-foreground",
                  "hover:bg-muted",
                  "transition-colors",
                )}>
                <Settings className="h-3 w-3" aria-hidden="true" />
                {__("Manage Signatures", "pressedmail")}
              </button>
            </div>
          </>
        )}

        <PopoverArrow className="fill-popover" />
      </PopoverContent>
    </Popover>
  );
};

/**
 * Inline signature selector for toolbar.
 */
interface InlineSignatureSelectorProps {
  /** Callback when signature is selected */
  onSelect: (signature: Signature | null) => void;
  /** Account ID to filter signatures */
  accountId?: number | null;
  /** Context for filtering */
  context?: SignatureInsertContext;
  /** Additional class names */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export const InlineSignatureSelector: React.FC<
  InlineSignatureSelectorProps
> = ({ onSelect, accountId = null, context, className, disabled = false }) => {
  const { loading } = useSignatures();
  const signatures = useAccountSignatures(accountId);
  const [open, setOpen] = useState(false);

  // Filter signatures based on context
  const filteredSignatures = useMemo(() => {
    if (!context) return signatures;

    return signatures.filter((sig) => {
      switch (context) {
        case "new":
          return sig.include_for_new;
        case "reply":
          return sig.include_for_reply;
        case "forward":
          return sig.include_for_forward;
        default:
          return true;
      }
    });
  }, [signatures, context]);

  if (loading || filteredSignatures.length === 0) {
    return null;
  }

  const handleSelect = (signature: Signature | null) => {
    onSelect(signature);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md",
            "text-sm font-medium transition-colors",
            "hover:bg-muted",
            "text-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}>
          <PenTool className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">
            {__("Signature", "pressedmail")}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "z-50 w-56 rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-lg",
          "animate-in fade-in-0 zoom-in-95",
        )}
        sideOffset={5}
        align="end">
        <div className="max-h-64 overflow-y-auto p-1">
          {/* No signature option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left",
              "text-sm transition-colors",
              "hover:bg-muted",
            )}>
            <span className="text-muted-foreground">
              {__("No signature", "pressedmail")}
            </span>
          </button>

          {/* Divider */}
          <div className="my-1 h-px bg-border" />

          {/* Signatures */}
          {filteredSignatures.map((sig) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => handleSelect(sig)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left",
                "text-sm transition-colors",
                "hover:bg-muted",
              )}>
              {sig.is_default && (
                <Star className="h-3 w-3 text-[var(--theme-starred,#f59e0b)] flex-shrink-0" />
              )}
              <span className="truncate">{sig.name}</span>
            </button>
          ))}
        </div>

        <PopoverArrow className="fill-popover" />
      </PopoverContent>
    </Popover>
  );
};

/**
 * Signature preview for displaying in compose area.
 */
interface SignaturePreviewProps {
  /** Signature to preview */
  signature: Signature;
  /** Additional class names */
  className?: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({
  signature,
  className,
}) => {
  if (signature.content_type === "html") {
    return (
      <div
        className={cn("signature-preview", className)}
        dangerouslySetInnerHTML={{
          __html: sanitizePreviewHtml(signature.content),
        }}
      />
    );
  }

  return (
    <div className={cn("signature-preview whitespace-pre-wrap", className)}>
      {signature.content}
    </div>
  );
};

export default SignatureSelector;
