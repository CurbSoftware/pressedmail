/**
 * ComposerAddressing: Addressing section for the email composer.
 *
 * Full-width recipient fields with inline Cc and Bcc text toggles, the way
 * mail clients show them, so they read as words rather than glyphs. Each
 * toggle is a disclosure button: its name stays "Cc" or "Bcc" and
 * aria-expanded carries the state, so a screen reader never hears a name that
 * contradicts it.
 *
 * @since 2.0.0
 */

import { useId } from "react";
import { __ } from "@wordpress/i18n";
import { RecipientInput } from "@/components/compose/RecipientInput";
import {
  dedupeRecipientGroupsByEmail,
  type Recipient,
  type RecipientGroups,
} from "@/types/recipients";
import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";

interface ComposerAddressingProps {
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  bccRecipients: Recipient[];
  showCc: boolean;
  showBcc: boolean;
  onToChange: (recipients: Recipient[]) => void;
  onCcChange: (recipients: Recipient[]) => void;
  onBccChange: (recipients: Recipient[]) => void;
  onShowCcChange: (show: boolean) => void;
  onShowBccChange: (show: boolean) => void;
  showListSuggestions?: boolean;
  disabled?: boolean;
  autoFocusTo?: boolean;
}

function sameRecipientList(a: Recipient[], b: Recipient[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((recipient, index) => {
    const other = b[index];
    return other?.id === recipient.id && other?.email === recipient.email;
  });
}

export function ComposerAddressing({
  toRecipients,
  ccRecipients,
  bccRecipients,
  showCc,
  showBcc,
  onToChange,
  onCcChange,
  onBccChange,
  onShowCcChange,
  onShowBccChange,
  showListSuggestions = false,
  disabled = false,
  autoFocusTo = false,
}: ComposerAddressingProps) {
  const ccFieldId = useId();
  const bccFieldId = useId();
  const applyRecipientGroups = (groups: RecipientGroups) => {
    const next = dedupeRecipientGroupsByEmail(groups);
    if (!sameRecipientList(toRecipients, next.to)) {
      onToChange(next.to);
    }
    if (!sameRecipientList(ccRecipients, next.cc)) {
      onCcChange(next.cc);
    }
    if (!sameRecipientList(bccRecipients, next.bcc)) {
      onBccChange(next.bcc);
    }
  };

  return (
    <div className="space-y-0">
      <div className="border-b border-border px-4 py-2" data-test="to-input">
        <div className="min-w-0 w-full" data-test="to-recipient-column">
          <RecipientInput
            label={__("To", "pressedmail")}
            value={toRecipients}
            onChange={(recipients) =>
              applyRecipientGroups({
                to: recipients,
                cc: ccRecipients,
                bcc: bccRecipients,
              })
            }
            placeholder={__("Recipients", "pressedmail")}
            showListSuggestions={showListSuggestions}
            disabled={disabled}
            autoFocus={autoFocusTo}
            trailingActions={
              <>
                <PressedTooltip
                  content={
                    showCc
                      ? __("Hide Cc", "pressedmail")
                      : __("Show Cc", "pressedmail")
                  }
                  side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-expanded={showCc}
                    aria-controls={showCc ? ccFieldId : undefined}
                    data-test="toggle-cc-button"
                    className="h-7 px-2 text-xs font-medium pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-muted-foreground aria-expanded:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowCcChange(!showCc);
                    }}>
                    {__("Cc", "pressedmail")}
                  </Button>
                </PressedTooltip>

                <PressedTooltip
                  content={
                    showBcc
                      ? __("Hide Bcc", "pressedmail")
                      : __("Show Bcc", "pressedmail")
                  }
                  side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-expanded={showBcc}
                    aria-controls={showBcc ? bccFieldId : undefined}
                    data-test="toggle-bcc-button"
                    className="h-7 px-2 text-xs font-medium pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-muted-foreground aria-expanded:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowBccChange(!showBcc);
                    }}>
                    {__("Bcc", "pressedmail")}
                  </Button>
                </PressedTooltip>
              </>
            }
          />
        </div>
      </div>

      {/* Cc Field, expanded */}
      {showCc && (
        <div
          id={ccFieldId}
          className="border-b border-border px-4 py-2"
          data-test="cc-input">
          <RecipientInput
            label={__("Cc", "pressedmail")}
            value={ccRecipients}
            dedupeRecipients={toRecipients}
            onChange={(recipients) =>
              applyRecipientGroups({
                to: toRecipients,
                cc: recipients,
                bcc: bccRecipients,
              })
            }
            placeholder={__("Cc recipients", "pressedmail")}
            disabled={disabled}
          />
        </div>
      )}

      {/* Bcc Field, expanded */}
      {showBcc && (
        <div
          id={bccFieldId}
          className="border-b border-border px-4 py-2"
          data-test="bcc-input">
          <RecipientInput
            label={__("Bcc", "pressedmail")}
            value={bccRecipients}
            dedupeRecipients={[...toRecipients, ...ccRecipients]}
            onChange={(recipients) =>
              applyRecipientGroups({
                to: toRecipients,
                cc: ccRecipients,
                bcc: recipients,
              })
            }
            placeholder={__("Bcc recipients", "pressedmail")}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
