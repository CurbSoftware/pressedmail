import { __ } from "@wordpress/i18n";
import {
  ExternalLink,
  Loader2,
  Maximize2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { EmailSendPlaneIcon } from "@/components/icons/MailActionIcons";

import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";
import { Button, ButtonGroup } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import {
  ComposerRemoveScheduleButton,
  ComposerScheduleSendButton,
} from "@/components/inbox/compose/ComposerScheduleActions.active";

export type ComposerHeaderSendGroupVariant = "compact" | "ribbon";

interface ComposerHeaderActionsProps {
  form: UseComposeFormReturn;
  showPopOut?: boolean;
  onPopOut?: () => void;
  showReturnToPane?: boolean;
  onReturnToPane?: () => void;
  /** Whether to show the expand-to-full-view action. */
  showFullView?: boolean;
  /** Expands the composer to fill the whole PressedMail window. */
  onFullView?: () => void;
  variant?: ComposerHeaderSendGroupVariant;
}

const RIBBON_BUTTON_CLASSES =
  "flex h-auto min-h-12 flex-col items-center justify-center gap-0.5 px-2 py-1 leading-none";
const RIBBON_LABEL_CLASSES = "text-[10px] text-muted-foreground";
const RIBBON_ICON_WRAP =
  "flex h-5 w-5 items-center justify-center [&_svg]:h-4 [&_svg]:w-4";
// Paper-plane tilts -30deg while the Send button is actively pressed; hover is
// unchanged. Relies on the Button root's `group/button` class.
const SEND_ICON_ROTATE_CLASS =
  "transition-transform group-active/button:-rotate-[30deg]";
// Sending is a distinct state from "can't send yet". Both used to collapse into
// `disabled`, so a send in flight looked identical to an empty recipient field,
// the one moment the user most wants confirmation that something happened. The
// success token is per-theme, so this tracks every colour scheme.
const SEND_IN_FLIGHT_CLASSES =
  "bg-success text-success-foreground hover:bg-success disabled:opacity-100";

function ReturnToComposePaneIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}>
        <path d="M3 17a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm1-5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
        <path d="M15 13h-4V9m0 4l5-5" />
      </g>
    </svg>
  );
}

export function ComposerHeaderSendGroup({
  form,
  showPopOut = false,
  onPopOut,
  showReturnToPane = false,
  onReturnToPane,
  showFullView = false,
  onFullView,
  variant = "compact",
}: ComposerHeaderActionsProps) {
  const {
    canSend,
    handleDiscard,
    handleSaveDraft,
    handleSend,
    isDiscarding,
    isSavingDraft,
    isScheduling,
    isSending,
    pendingInlineImageUploads,
  } = form;

  const deleteLabel = __("Delete message", "pressedmail");
  const popOutLabel = __("Pop out compose pane", "pressedmail");
  const returnToPaneLabel = __("Return to compose pane", "pressedmail");
  const fullViewLabel = __("Expand compose to full view", "pressedmail");
  const isDeliveryPending =
    isSending || isScheduling || isDiscarding || pendingInlineImageUploads > 0;

  if (variant === "ribbon") {
    const sendLabel = isSending
      ? __("Sending...", "pressedmail")
      : __("Send", "pressedmail");
    const saveLabel = isSavingDraft
      ? __("Saving...", "pressedmail")
      : __("Save Draft", "pressedmail");

    return (
      <div
        className="flex items-stretch gap-1"
        data-test="composer-header-actions"
        data-testid="composer-header-actions"
        data-variant="ribbon">
        <ButtonGroup>
          <Button
            onClick={handleSend}
            data-test="send-button"
            data-sending={isSending ? "true" : undefined}
            aria-label={sendLabel}
            aria-busy={isSending || undefined}
            disabled={isDeliveryPending || !canSend}
            size="sm"
            className={cn(
              RIBBON_BUTTON_CLASSES,
              isSending && SEND_IN_FLIGHT_CLASSES,
            )}>
            <span className={RIBBON_ICON_WRAP}>
              {isSending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <EmailSendPlaneIcon className={SEND_ICON_ROTATE_CLASS} />
              )}
            </span>
            <span className={RIBBON_LABEL_CLASSES}>{sendLabel}</span>
          </Button>

          <ComposerScheduleSendButton
            form={form}
            isDeliveryPending={isDeliveryPending}
            variant="ribbon"
          />
        </ButtonGroup>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={saveLabel}
          onClick={() => handleSaveDraft()}
          disabled={isSavingDraft || isDeliveryPending}
          className={RIBBON_BUTTON_CLASSES}>
          <span className={RIBBON_ICON_WRAP}>
            {isSavingDraft ? <Loader2 className="animate-spin" /> : <Save />}
          </span>
          <span className={RIBBON_LABEL_CLASSES}>{saveLabel}</span>
        </Button>

        <ComposerRemoveScheduleButton
          form={form}
          isDeliveryPending={isDeliveryPending}
          variant="ribbon"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={deleteLabel}
          onClick={handleDiscard}
          disabled={isDeliveryPending}
          data-test="delete-compose-button"
          className={cn(
            RIBBON_BUTTON_CLASSES,
            "text-destructive hover:text-destructive",
          )}>
          <span className={RIBBON_ICON_WRAP}>
            <Trash2 />
          </span>
          <span className={RIBBON_LABEL_CLASSES}>
            {__("Discard", "pressedmail")}
          </span>
        </Button>

        {showPopOut && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={popOutLabel}
            onClick={onPopOut}
            className={RIBBON_BUTTON_CLASSES}>
            <span className={RIBBON_ICON_WRAP}>
              <ExternalLink />
            </span>
            <span className={RIBBON_LABEL_CLASSES}>
              {__("Pop out", "pressedmail")}
            </span>
          </Button>
        )}

        {showReturnToPane && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={returnToPaneLabel}
            onClick={onReturnToPane}
            data-test="return-compose-pane-button"
            className={RIBBON_BUTTON_CLASSES}>
            <span className={RIBBON_ICON_WRAP}>
              <ReturnToComposePaneIcon />
            </span>
            <span className={RIBBON_LABEL_CLASSES}>
              {__("Pane", "pressedmail")}
            </span>
          </Button>
        )}

        {showFullView && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={fullViewLabel}
            onClick={onFullView}
            data-test="full-view-compose-button"
            className={RIBBON_BUTTON_CLASSES}>
            <span className={RIBBON_ICON_WRAP}>
              <Maximize2 />
            </span>
            <span className={RIBBON_LABEL_CLASSES}>
              {__("Full view", "pressedmail")}
            </span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5"
      data-test="composer-header-actions"
      data-testid="composer-header-actions">
      <ButtonGroup>
        <Button
          onClick={handleSend}
          data-test="send-button"
          data-sending={isSending ? "true" : undefined}
          aria-busy={isSending || undefined}
          disabled={isDeliveryPending || !canSend}
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-3",
            isSending && SEND_IN_FLIGHT_CLASSES,
          )}>
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <EmailSendPlaneIcon
              className={cn("h-4 w-4", SEND_ICON_ROTATE_CLASS)}
            />
          )}
          {isSending
            ? __("Sending...", "pressedmail")
            : __("Send", "pressedmail")}
        </Button>

        <ComposerScheduleSendButton
          form={form}
          isDeliveryPending={isDeliveryPending}
          variant="compact"
        />
      </ButtonGroup>

      <PressedTooltip content={__("Save draft", "pressedmail")} side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={__("Save draft", "pressedmail")}
          onClick={() => handleSaveDraft()}
          disabled={isSavingDraft || isDeliveryPending}
          className="h-8 w-8">
          {isSavingDraft ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </PressedTooltip>

      <ComposerRemoveScheduleButton
        form={form}
        isDeliveryPending={isDeliveryPending}
        variant="compact"
      />

      <PressedTooltip content={deleteLabel} side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={deleteLabel}
          onClick={handleDiscard}
          disabled={isDeliveryPending}
          data-test="delete-compose-button"
          className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </PressedTooltip>

      {showPopOut && (
        <PressedTooltip content={popOutLabel} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={popOutLabel}
            onClick={onPopOut}
            className="h-8 w-8">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </PressedTooltip>
      )}

      {showReturnToPane && (
        <PressedTooltip content={returnToPaneLabel} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={returnToPaneLabel}
            onClick={onReturnToPane}
            data-test="return-compose-pane-button"
            className="h-8 w-8">
            <ReturnToComposePaneIcon className="h-4 w-4" />
          </Button>
        </PressedTooltip>
      )}

      {showFullView && (
        <PressedTooltip content={fullViewLabel} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={fullViewLabel}
            onClick={onFullView}
            data-test="full-view-compose-button"
            className="h-8 w-8">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </PressedTooltip>
      )}
    </div>
  );
}

export function ComposerHeaderCloseButton({
  form,
}: {
  form: UseComposeFormReturn;
}) {
  const closeLabel = __("Close", "pressedmail");

  return (
    <PressedTooltip content={closeLabel} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={closeLabel}
        onClick={form.handleDiscard}
        disabled={
          form.isSending ||
          form.isScheduling ||
          form.isDiscarding ||
          form.pendingInlineImageUploads > 0
        }
        data-test="discard-button"
        className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </PressedTooltip>
  );
}

export function ComposerHeaderActions(props: ComposerHeaderActionsProps) {
  return (
    <>
      <ComposerHeaderSendGroup {...props} />
      <ComposerHeaderCloseButton form={props.form} />
    </>
  );
}
