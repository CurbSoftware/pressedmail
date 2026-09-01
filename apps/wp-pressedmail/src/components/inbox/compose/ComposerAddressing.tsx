/**
 * ComposerAddressing: Addressing section for the email composer.
 *
 * Full-width recipient fields with inline Cc/Bcc action buttons.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";
import { EyeOff, Users } from "lucide-react";
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
                    size="icon"
                    aria-label={
                      showCc
                        ? __("Hide Cc", "pressedmail")
                        : __("Show Cc", "pressedmail")
                    }
                    data-test="toggle-cc-button"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowCcChange(!showCc);
                    }}>
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
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
                    size="icon"
                    aria-label={
                      showBcc
                        ? __("Hide Bcc", "pressedmail")
                        : __("Show Bcc", "pressedmail")
                    }
                    data-test="toggle-bcc-button"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowBccChange(!showBcc);
                    }}>
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PressedTooltip>
              </>
            }
          />
        </div>
      </div>

      {/* Cc Field, expanded */}
      {showCc && (
        <div className="border-b border-border px-4 py-2" data-test="cc-input">
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
        <div className="border-b border-border px-4 py-2" data-test="bcc-input">
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
