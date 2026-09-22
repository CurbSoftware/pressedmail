import { useRef, type ChangeEvent } from "react";
import { __ } from "@wordpress/i18n";

import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";
import { Button, ButtonGroup } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";
import {
  EmailImportantIcon,
  EmailImportantOutlineIcon,
} from "@/components/icons/MailActionIcons";

type SubjectAttachmentForm = Pick<
  UseComposeFormReturn,
  | "canUploadAttachments"
  | "canUseMediaLibraryAttachments"
  | "fileInputRef"
  | "handleAttachment"
  | "handleMediaLibraryAttachment"
  | "getComposeSessionVersion"
  | "isImportant"
  | "isDiscarding"
  | "isScheduling"
  | "isSending"
  | "setIsImportant"
>;

interface ComposerSubjectAttachmentActionsProps {
  form: SubjectAttachmentForm;
}

export function ComposerSubjectAttachmentActions({
  form,
}: ComposerSubjectAttachmentActionsProps) {
  const {
    canUploadAttachments,
    canUseMediaLibraryAttachments,
    fileInputRef,
    handleAttachment,
    handleMediaLibraryAttachment,
    getComposeSessionVersion,
    isImportant,
    isDiscarding,
    isScheduling,
    isSending,
    setIsImportant,
  } = form;
  const attachmentPickerSessionRef = useRef<number | null | undefined>(
    undefined,
  );
  const isDeliveryPending = isSending || isScheduling || isDiscarding;

  const handleAttachClick = () => {
    attachmentPickerSessionRef.current = getComposeSessionVersion();
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const composeSessionVersion = attachmentPickerSessionRef.current;
    attachmentPickerSessionRef.current = undefined;
    if (
      isDeliveryPending ||
      composeSessionVersion === undefined ||
      getComposeSessionVersion() !== composeSessionVersion
    ) {
      event.target.value = "";
      return;
    }
    handleAttachment(event);
  };

  const ImportanceIcon = isImportant
    ? EmailImportantIcon
    : EmailImportantOutlineIcon;

  return (
    <ButtonGroup data-test="subject-attachment-actions">
      {/* Sender-set importance: stamps cross-provider priority headers on send. */}
      <PressedTooltip
        content={
          isImportant
            ? __("Marked important", "pressedmail")
            : __("Mark as important", "pressedmail")
        }
        side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            isImportant && "text-primary",
          )}
          onClick={() => setIsImportant(!isImportant)}
          disabled={isDeliveryPending}
          aria-pressed={isImportant}
          aria-label={__("Mark as important", "pressedmail")}
          data-test="compose-importance-toggle">
          <ImportanceIcon className="h-3.5 w-3.5" />
        </Button>
      </PressedTooltip>

      {canUploadAttachments && (
        <>
          <PressedTooltip
            content={__("Attach files", "pressedmail")}
            side="bottom">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              onClick={handleAttachClick}
              disabled={isDeliveryPending}
              aria-label={__("Attach files", "pressedmail")}
              data-test="attachment-button">
              <svg
                className="h-3.5 w-3.5"
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false">
                <path
                  fill="currentColor"
                  d="M7.5 16.5h6.05c-.21.47-.37.97-.46 1.5H7.5C4.46 18 2 15.54 2 12.5S4.46 7 7.5 7H18c2.21 0 4 1.79 4 4c0 .91-.31 1.74-.83 2.41c-.54-.21-1.12-.34-1.72-.38A2.495 2.495 0 0 0 18 8.5H7.5c-2.21 0-4 1.79-4 4s1.79 4 4 4m2-3c-.55 0-1-.45-1-1s.45-1 1-1H17V10H9.5a2.5 2.5 0 0 0 0 5h5.04a6 6 0 0 1 2.07-1.5zM20 18v-3h-2v3h-3v2h3v3h2v-3h3v-2z"
                />
              </svg>
            </Button>
          </PressedTooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleAttachmentChange}
            disabled={isDeliveryPending}
            className="hidden"
            accept="*/*"
          />
        </>
      )}

      {canUseMediaLibraryAttachments && (
        <PressedTooltip
          content={__("Attach from Media Library", "pressedmail")}
          side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            onClick={() => void handleMediaLibraryAttachment()}
            disabled={isDeliveryPending}
            aria-label={__("Attach from Media Library", "pressedmail")}
            data-test="media-library-attachment-button">
            <svg
              className="h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 2048 2048"
              aria-hidden="true"
              focusable="false">
              <path
                fill="currentColor"
                d="M256 384h128v128H256zm0 256h128v128H256zm896-256h128v128h-128zm731 896h-310l155-154zm-475-320q0-26 19-45t45-19t45 19t19 45t-19 45t-45 19t-45-19t-19-45m640-320v896h-128V768H640v549l320-319l448 447l128-128v182l-37 37h-182l-357-358l-320 321v165h640v128H512v-640H0V0h1536v640zm-640 0V128h-128v128h-128V128H384v128H256V128H128v896h128V896h128v128h128V640zm384 1024h256v128h-256v256h-128v-256h-256v-128h256v-256h128z"
              />
            </svg>
          </Button>
        </PressedTooltip>
      )}
    </ButtonGroup>
  );
}
