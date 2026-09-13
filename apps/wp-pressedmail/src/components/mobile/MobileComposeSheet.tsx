"use client";

import { __, sprintf } from "@wordpress/i18n";

import { MobileComposeScreen } from "@/admin/pages/mobile/MobileComposeScreen";

interface MobileComposeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  replyTo?: {
    to: string;
    subject: string;
    messageId?: string;
  };
}

/**
 * Compatibility shell for the legacy mobile inbox layout. The routed mobile
 * composer owns all draft, attachment, scheduling, and delivery behavior.
 */
export function MobileComposeSheet({
  isOpen,
  onClose,
  replyTo,
}: MobileComposeSheetProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <MobileComposeScreen
        onClose={onClose}
        initialFields={
          replyTo
            ? {
                to: replyTo.to,
                subject: replyTo.subject
                  ? sprintf(
                      /* translators: %s: the subject of the message being replied to. */
                      __("Re: %s", "pressedmail"),
                      replyTo.subject,
                    )
                  : "",
              }
            : undefined
        }
      />
    </div>
  );
}
