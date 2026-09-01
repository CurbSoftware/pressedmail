"use client";

import { __ } from "@wordpress/i18n";
import { Code2, Copy, FileDown, Flag, Printer } from "lucide-react";
import type { ReactNode } from "react";

import { EmailMoreActionsIcon } from "@/components/icons/MailActionIcons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kit/ui/plugin";

import { VerticalRibbonAction } from "./VerticalRibbonAction";
import {
  PRESSED_OUT_RIBBON_ICON_CLASS,
  PressedOutRibbonButton,
} from "@/components/inbox/ribbon/RibbonButton";
import { MAIL_ACTION_ICON_CLASS } from "./reading-pane-action-icons";

export function ReadingPaneMoreMenu({
  disabled,
  children,
  orientation = "horizontal",
  onPrint,
  onCopyReference,
  onViewHeaders,
  onDownloadEml,
  onFlag,
  isFlagged,
}: {
  disabled?: boolean;
  children?: ReactNode;
  orientation?: "horizontal" | "vertical" | "pressedout-command";
  onPrint?: () => void;
  onCopyReference?: () => void;
  onViewHeaders?: () => void;
  onDownloadEml?: () => void;
  /**
   * Optional "Flag" toggle. When omitted, the Flag item is not rendered.
   */
  onFlag?: () => void;
  isFlagged?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {orientation === "pressedout-command" ? (
          <PressedOutRibbonButton
            label={__("More", "pressedmail")}
            disabled={disabled}
            ariaLabel={__("More message actions", "pressedmail")}
            dataTest="reading-pane-action-more"
            icon={
              <EmailMoreActionsIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
            }
          />
        ) : orientation === "vertical" ? (
          <VerticalRibbonAction
            icon={<EmailMoreActionsIcon />}
            label={__("More", "pressedmail")}
            ariaLabel={__("More message actions", "pressedmail")}
            disabled={disabled}
            dataTest="reading-pane-action-more"
          />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={__("More message actions", "pressedmail")}
            className="h-7 w-7">
            <EmailMoreActionsIcon className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {onFlag && (
          <DropdownMenuItem onSelect={onFlag}>
            <Flag className="mr-2 h-4 w-4" />
            {isFlagged
              ? __("Unflag", "pressedmail")
              : __("Flag", "pressedmail")}
          </DropdownMenuItem>
        )}
        {children}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!onPrint} onSelect={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          {__("Print", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onViewHeaders} onSelect={onViewHeaders}>
          <Code2 className="mr-2 h-4 w-4" />
          {__("View headers", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onDownloadEml} onSelect={onDownloadEml}>
          <FileDown className="mr-2 h-4 w-4" />
          {__("Download .eml", "pressedmail")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!onCopyReference}
          onSelect={onCopyReference}>
          <Copy className="mr-2 h-4 w-4" />
          {__("Copy message reference", "pressedmail")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
