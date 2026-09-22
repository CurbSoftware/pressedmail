"use client";

/**
 * Fixed composer toolbar (Plate playground template parity).
 *
 * LEFT groups render from COMPOSER_TOOLBAR_GROUPS and respect the user's
 * saved toolbar customization via resolveComposerToolbarItems. The RIGHT
 * cluster (signature, preview, print, customize) always
 * renders, it is never filtered by the saved item set.
 */

import React from "react";
import { KEYS } from "@kit/plate";
import {
  getPlateEmailEditorSurfacePreset,
  PLATE_EMAIL_EDITOR_DIALECTS,
  type PlateEmailEditorDialect,
  type PlateEmailEditorSurface,
} from "@kit/plate/email-surfaces";
import { useEditorRef } from "@kit/plate/react";
import {
  CaseSensitive,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageGlyph,
  Link as LinkGlyph,
  PaintRoller,
  PenTool,
  Printer,
  MoreHorizontal,
  Sliders,
  Sparkles,
  Upload,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator as DropdownMenuSep,
  DropdownMenuTrigger,
  Popover,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kit/ui/plugin";
import {
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";

import { __ } from "@wordpress/i18n";

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  COMPOSER_TOOLBAR_ICON_CLASS,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
} from "@/components/composer/toolbar";
import {
  HighlightColorToolbarButton,
  TextColorToolbarButton,
} from "@/components/composer/toolbar-buttons";
import { AIToolbarButton } from "@/components/composer/plate/ai-toolbar-button.active";
import { AlignToolbarButton } from "@/components/composer/plate/align-toolbar-button";
import { FontSizeToolbarButton } from "@/components/composer/plate/font-size-toolbar-button";
import {
  RedoToolbarButton,
  UndoToolbarButton,
} from "@/components/composer/plate/history-toolbar-button";
import { ImportExportToolbarButton } from "@/components/composer/plate/import-export-toolbar-button";
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from "@/components/composer/plate/indent-toolbar-button";
import { HorizontalRuleToolbarButton } from "@/components/composer/plate/horizontal-rule-toolbar-button";
import { EmojiToolbarButton } from "@/components/composer/plate/emoji-toolbar-button";
import { LineHeightToolbarButton } from "@/components/composer/plate/line-height-toolbar-button";
import { LinkToolbarButton } from "@/components/composer/plate/link-toolbar-button";
import { ListToolbarButton } from "@/components/composer/plate/list-toolbar-button";
import { MarkToolbarButton } from "@/components/composer/plate/mark-toolbar-button";
import { MediaUrlDialog } from "@/components/composer/plate/media-toolbar-button";
import { MoreToolbarButton } from "@/components/composer/plate/more-toolbar-button";
import { TableToolbarButton } from "@/components/composer/plate/table-toolbar-button";
import { TurnIntoToolbarButton } from "@/components/composer/plate/turn-into-toolbar-button";
import { ComposerColorPalette } from "@/components/ui/color-picker/ComposerColorPalette";
import {
  ComposerToolbarCustomizeDialog,
  type ComposerToolbarCustomizeDialogProps,
} from "./ComposerToolbarCustomizeDialog";
import { cn } from "@/lib/utils";
import { composerDialectLabel } from "@/components/composer/plate-composer-dialect";
import {
  COMPOSER_TOOLBAR_GROUPS,
  resolveComposerToolbarItems,
} from "./composer-toolbar-registry";
import { printEmailContent } from "@/lib/print-email-content";
import {
  recipientsToString,
  type Recipient,
} from "@/types/recipients";
import {
  getComposerFontOptions,
  resolveComposerFontOptionFromFamily,
} from "@/lib/font-registry";
import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";
import {
  useUserPreferences,
  type ComposerToolbarItemId,
} from "@/hooks/useUserPreferences";
import { useComposerPalettesEnabled } from "@/hooks/useComposerPalettesEnabled";
import type { Signature } from "@/types/signatures";

export type ComposerAuthoringSurface = PlateEmailEditorSurface;

const FONT_FAMILIES = getComposerFontOptions();

/**
 * The slice of a compose form the toolbar actually reads.
 *
 * Narrower than `UseComposeFormReturn` on purpose. The authoring surfaces
 * (signature, auto-reply, content block) have no compose form at all, and typing
 * this prop as the full contract forced them to fabricate one and cast it, which
 * is how a control wired to nothing shipped. A toolbar that declares only what
 * it reads cannot drift from its callers, and a caller with no recipients says
 * so by passing none rather than by faking a form.
 *
 * A real `UseComposeFormReturn` satisfies this structurally, so the email
 * composer passes its form unchanged.
 */
export interface ComposerToolbarForm {
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  bccRecipients: Recipient[];
  subject: string;
  body: string;
  bodyBackgroundColor?: string;
  canvasBackgroundColor?: string;
  showAIPanel: boolean;
  handleSignatureSelect: (signatureId: number) => void;
}

export interface ComposerEditorToolbarProps {
  form: ComposerToolbarForm;
  disabled?: boolean;
  editorRef: React.RefObject<{ getHTML: () => string } | null>;
  signaturesEnabled: boolean;
  signatures: Signature[];
  canUseMediaLibraryAttachments: boolean;
  canUploadAttachments: boolean;
  onImageLibrary: () => void;
  onImageUpload: () => void;
  onTogglePreview: () => void;
  previewActive: boolean;
  /** The block editor's current dialect. Defaults to Markdown. */
  dialect?: PlateEmailEditorDialect;
  /** Picks the per-compose dialect override. */
  onSelectDialect?: (dialect: PlateEmailEditorDialect) => void;
  onToggleContentType?: () => void;
  /**
   * Absent means "this surface has no body background to set", and the control
   * is then not rendered at all. Passing an inert function instead put a button
   * in the toolbar that did nothing when clicked, which is worse than a missing
   * button: the author cannot tell whether the click worked.
   */
  onSetBodyBackgroundColor?: (color: string | undefined) => void;
  onSetCanvasBackgroundColor?: (color: string | undefined) => void;
  surface?: ComposerAuthoringSurface;
  contentBlocksEnabled?: boolean;
  toolbarVariant?: "desktop" | "mobile";
}

export function ComposerEditorToolbar({
  form,
  disabled = false,
  editorRef,
  signaturesEnabled,
  signatures,
  canUseMediaLibraryAttachments,
  canUploadAttachments,
  onImageLibrary,
  onImageUpload,
  onTogglePreview,
  previewActive,
  dialect = "markdown",
  onSelectDialect,
  onSetBodyBackgroundColor,
  onSetCanvasBackgroundColor,
  surface = "email",
  contentBlocksEnabled = false,
  toolbarVariant = "desktop",
}: ComposerEditorToolbarProps) {
  const { preferences } = useUserPreferences();
  const palettesEnabled = useComposerPalettesEnabled();
  const isEmailSurface = surface === "email";
  const surfacePreset = getPlateEmailEditorSurfacePreset(surface);
  const surfaceFeatures = surfacePreset.features;
  const isMobileToolbar = toolbarVariant === "mobile";
  const aiEnabled = surfaceFeatures.aiCommands && Boolean(form.showAIPanel);
  const contentBlocksAvailable =
    contentBlocksEnabled && surfaceFeatures.contentBlocks;
  const canUseMediaLibraryInlineImages =
    canUseMediaLibraryAttachments &&
    surfaceFeatures.inlineMedia &&
    surfaceFeatures.mediaLibrary;
  const canUploadInlineImages =
    canUploadAttachments &&
    surfaceFeatures.inlineMedia &&
    surfaceFeatures.localImageUpload;
  const inlineImagesEnabled =
    canUseMediaLibraryInlineImages || canUploadInlineImages;

  const visibleItems = React.useMemo(
    () =>
      resolveComposerToolbarItems(
        isMobileToolbar
          ? preferences.composer_mobile_toolbar_preset
          : preferences.composer_toolbar_preset,
        isMobileToolbar
          ? preferences.composer_mobile_toolbar_items
          : preferences.composer_toolbar_items,
        {
          surface,
          contentBlocksEnabled: contentBlocksAvailable,
          inlineImagesEnabled,
          aiEnabled,
        },
      ),
    [
      aiEnabled,
      contentBlocksAvailable,
      inlineImagesEnabled,
      isMobileToolbar,
      preferences.composer_mobile_toolbar_items,
      preferences.composer_mobile_toolbar_preset,
      preferences.composer_toolbar_items,
      preferences.composer_toolbar_preset,
      surface,
    ],
  );

  const renderItem = (id: ComposerToolbarItemId): React.ReactNode => {
    switch (id) {
      case "history_undo":
        return <UndoToolbarButton key={id} />;
      case "history_redo":
        return <RedoToolbarButton key={id} />;
      case "ai":
        return (
          <AIToolbarButton
            key={id}
            tooltip={__("AI Tools", "pressedmail")}
            className="text-primary">
            <Sparkles className="size-4" />
          </AIToolbarButton>
        );
      case "import_export":
        return (
          <ImportExportToolbarButton
            key={id}
            bodyBackgroundColor={form.bodyBackgroundColor}
            onBodyBackgroundColorChange={onSetBodyBackgroundColor}
          />
        );
      case "horizontal_rule":
        return <HorizontalRuleToolbarButton key={id} />;
      case "block_style":
        return <TurnIntoToolbarButton key={id} />;
      case "font_size":
        return (
          <FontSizeToolbarButton
            key={id}
            defaultFontSize={String(
              Number(preferences.composer_default_font_size) || 14,
            )}
          />
        );
      case "font_family":
        return <FontFamilyDropdown key={id} disabled={disabled} />;
      case "bold":
        return (
          <MarkToolbarButton
            key={id}
            nodeType={KEYS.bold}
            tooltip={__("Bold", "pressedmail")}>
            <Bold className="size-4" />
          </MarkToolbarButton>
        );
      case "italic":
        return (
          <MarkToolbarButton
            key={id}
            nodeType={KEYS.italic}
            tooltip={__("Italic", "pressedmail")}>
            <Italic className="size-4" />
          </MarkToolbarButton>
        );
      case "underline":
        return (
          <MarkToolbarButton
            key={id}
            nodeType={KEYS.underline}
            tooltip={__("Underline", "pressedmail")}>
            <UnderlineIcon className="size-4" />
          </MarkToolbarButton>
        );
      case "strikethrough":
        return (
          <MarkToolbarButton
            key={id}
            nodeType={KEYS.strikethrough}
            tooltip={__("Strikethrough", "pressedmail")}>
            <Strikethrough className="size-4" />
          </MarkToolbarButton>
        );
      case "inline_code":
        return (
          <MarkToolbarButton
            key={id}
            nodeType={KEYS.code}
            tooltip={__("Inline code", "pressedmail")}>
            <Code2 className="size-4" />
          </MarkToolbarButton>
        );
      case "text_color":
        return palettesEnabled ? <TextColorToolbarButton key={id} /> : null;
      case "highlight_color":
        return palettesEnabled ? (
          <HighlightColorToolbarButton key={id} />
        ) : null;
      case "body_background":
        return isEmailSurface && palettesEnabled && onSetBodyBackgroundColor ? (
          <BodyBackgroundPopover
            key={id}
            disabled={disabled}
            bodyBackgroundColor={form.bodyBackgroundColor}
            canvasBackgroundColor={form.canvasBackgroundColor}
            onSetBodyBackgroundColor={onSetBodyBackgroundColor}
            onSetCanvasBackgroundColor={onSetCanvasBackgroundColor}
          />
        ) : null;
      case "align":
        return <AlignToolbarButton key={id} />;
      case "list_menu":
        return <ListToolbarButton key={id} />;
      case "insert_link":
        return <LinkToolbarButton key={id} />;
      case "insert_table":
        return <TableToolbarButton key={id} />;
      case "emoji":
        return <EmojiToolbarButton key={id} />;
      case "insert_image_library":
        return (
          <InsertImageDropdown
            key={id}
            disabled={disabled}
            canUseMediaLibrary={canUseMediaLibraryInlineImages}
            canUpload={canUploadInlineImages}
            onImageLibrary={onImageLibrary}
            onImageUpload={onImageUpload}
          />
        );
      case "line_height":
        return <LineHeightToolbarButton key={id} />;
      case "outdent":
        return <OutdentToolbarButton key={id} />;
      case "indent":
        return <IndentToolbarButton key={id} />;
      case "content_blocks":
        return null;
      case "more_menu":
        return (
          <MoreToolbarButton
            key={id}
            showClearFormatting={visibleItems.has("clear_formatting")}
          />
        );
      // Clear formatting renders inside the More menu (see more_menu above).
      case "clear_formatting":
        return null;
      // Right-side actions are rendered unconditionally below, never via the
      // registry-driven left groups.
      case "signature":
      case "preview":
      case "print":
        return null;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "bg-card text-card-foreground [color-scheme:light_dark] px-1 py-1",
        isMobileToolbar && "[&_button]:min-h-11 [&_button]:min-w-11",
      )}
      aria-disabled={disabled || undefined}
      inert={disabled ? true : undefined}
      data-test="composer-toolbar">
      <Toolbar className="flex flex-wrap items-center gap-0.5">
        {COMPOSER_TOOLBAR_GROUPS.filter((group) => group.id !== "actions").map(
          (group) => {
            const children = group.items
              .filter((item) => visibleItems.has(item.id))
              .map((item) => renderItem(item.id))
              .filter(Boolean);

            if (children.length === 0) return null;

            return <ToolbarGroup key={group.id}>{children}</ToolbarGroup>;
          },
        )}

        {/* Actions (right-aligned), never filtered by the saved item set */}
        <div
          className="ml-auto flex flex-wrap items-center gap-0.5"
          data-test="composer-toolbar-actions">
          {/* Signature */}
          {isEmailSurface &&
            surfaceFeatures.signatures &&
            signaturesEnabled &&
            signatures.length > 0 && (
              <ToolbarGroup>
                <SignatureDropdown
                  signatures={signatures}
                  form={form}
                  disabled={disabled}
                />
              </ToolbarGroup>
            )}

          {/* Preview, email surface only (the authoring-surface parity
              tests pin Preview as an intentional email-only control) */}
          {isEmailSurface && (
            <ToolbarGroup>
              <ToolbarButton
                tooltip={__("Preview", "pressedmail")}
                pressed={previewActive}
                className={
                  previewActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }
                onClick={onTogglePreview}
                disabled={disabled}>
                <Eye className="size-4" />
              </ToolbarButton>
            </ToolbarGroup>
          )}

          {/* Format, intentionally between Preview and Print. */}
          {isEmailSurface && (
            <ToolbarGroup>
              <ComposerFormatDropdown
                dialect={dialect}
                disabled={disabled}
                onSelectDialect={onSelectDialect}
              />
            </ToolbarGroup>
          )}

          {/* Print */}
          {isEmailSurface && !isMobileToolbar && (
            <ToolbarGroup>
              <ToolbarButton
                tooltip={__("Print", "pressedmail")}
                onClick={() =>
                  printEmailContent({
                    bcc: recipientsToString(form.bccRecipients),
                    bodyBackgroundColor: form.bodyBackgroundColor,
                    cc: recipientsToString(form.ccRecipients),
                    html:
                      (
                        editorRef.current as { getHTML?: () => string }
                      )?.getHTML?.() ||
                      form.body ||
                      "",
                    mode: "compose",
                    subject: form.subject,
                    to: recipientsToString(form.toRecipients),
                  })
                }
                disabled={disabled}>
                <Printer className="size-4" />
              </ToolbarButton>
            </ToolbarGroup>
          )}

          {isMobileToolbar ? (
            <ComposerSecondaryActions
              disabled={disabled}
              onPrint={
                isEmailSurface
                  ? () =>
                      printEmailContent({
                        bcc: recipientsToString(form.bccRecipients),
                        bodyBackgroundColor: form.bodyBackgroundColor,
                        cc: recipientsToString(form.ccRecipients),
                        html: editorRef.current?.getHTML?.() || form.body || "",
                        mode: "compose",
                        subject: form.subject,
                        to: recipientsToString(form.toRecipients),
                      })
                  : undefined
              }
              customize={{
                surface,
                target: "mobile",
                aiInteractive: aiEnabled,
                contentBlocksEnabled: contentBlocksAvailable,
                inlineImagesEnabled,
              }}
            />
          ) : (
            <ToolbarGroup>
              <ComposerToolbarCustomizeDialog
                surface={surface}
                target={isMobileToolbar ? "mobile" : "desktop"}
                aiInteractive={aiEnabled}
                contentBlocksEnabled={contentBlocksAvailable}
                inlineImagesEnabled={inlineImagesEnabled}
              />
            </ToolbarGroup>
          )}
        </div>
      </Toolbar>
    </div>
  );
}

function ComposerSecondaryActions({
  disabled,
  onPrint,
  customize,
}: {
  disabled: boolean;
  onPrint?: () => void;
  customize?: ComposerToolbarCustomizeDialogProps;
}) {
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  return (
    <ToolbarGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            tooltip={__("More actions", "pressedmail")}
            disabled={disabled}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onPrint && (
            <DropdownMenuItem className="min-h-11" onSelect={onPrint}>
              <Printer aria-hidden="true" />
              {__("Print", "pressedmail")}
            </DropdownMenuItem>
          )}
          {customize && (
            <DropdownMenuItem
              className="min-h-11"
              onSelect={() => setCustomizeOpen(true)}>
              <Sliders aria-hidden="true" />
              {__("Customize toolbar", "pressedmail")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {customize && (
        <ComposerToolbarCustomizeDialog
          {...customize}
          hideTrigger
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
        />
      )}
    </ToolbarGroup>
  );
}

export interface ComposerPlainTextToolbarProps {
  form: UseComposeFormReturn;
  toolbarVariant?: "desktop" | "mobile";
  disabled?: boolean;
  signaturesEnabled: boolean;
  signatures: Signature[];
  onTogglePreview: () => void;
  previewActive: boolean;
  onToggleContentType: () => void;
}

/** Context-free toolbar for the textarea composer (no Plate hooks/plugins). */
export function ComposerPlainTextToolbar({
  form,
  disabled = false,
  toolbarVariant = "desktop",
  signaturesEnabled,
  signatures,
  onTogglePreview,
  previewActive,
  onToggleContentType,
}: ComposerPlainTextToolbarProps) {
  return (
    <div
      className={cn(
        "bg-card px-1 py-1 text-card-foreground [color-scheme:light_dark]",
        toolbarVariant === "mobile" &&
          "[&_button]:min-h-11 [&_button]:min-w-11",
      )}
      aria-disabled={disabled || undefined}
      inert={disabled ? true : undefined}
      data-test="composer-toolbar">
      <Toolbar className="flex flex-wrap items-center gap-0.5">
        <div
          className="ml-auto flex flex-wrap items-center gap-0.5"
          data-test="composer-toolbar-actions">
          {signaturesEnabled && signatures.length > 0 ? (
            <ToolbarGroup>
              <SignatureDropdown
                signatures={signatures}
                form={form}
                disabled={disabled}
              />
            </ToolbarGroup>
          ) : null}
          <ToolbarGroup>
            <ToolbarButton
              tooltip={__("Preview", "pressedmail")}
              pressed={previewActive}
              className={
                previewActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              }
              onClick={onTogglePreview}
              disabled={disabled}>
              <Eye className="size-4" />
            </ToolbarButton>
          </ToolbarGroup>
          <ToolbarGroup>
            {/* Leaves the textarea for the Plate editor, which stays in
                whichever dialect it was last in. Naming a dialect here would
                be a promise this button cannot keep. */}
            <ToolbarButton
              tooltip={__("Switch to formatted text", "pressedmail")}
              onClick={onToggleContentType}
              disabled={disabled}>
              <FileText className="size-4" />
            </ToolbarButton>
          </ToolbarGroup>
          {toolbarVariant === "mobile" ? (
            <ComposerSecondaryActions
              disabled={disabled}
              onPrint={() =>
                printEmailContent({
                  bcc: recipientsToString(form.bccRecipients),
                  cc: recipientsToString(form.ccRecipients),
                  mode: "compose",
                  subject: form.subject,
                  text: form.body,
                  to: recipientsToString(form.toRecipients),
                })
              }
            />
          ) : (
            <ToolbarGroup>
              <ToolbarButton
                tooltip={__("Print", "pressedmail")}
                onClick={() =>
                  printEmailContent({
                    bcc: recipientsToString(form.bccRecipients),
                    cc: recipientsToString(form.ccRecipients),
                    mode: "compose",
                    subject: form.subject,
                    text: form.body,
                    to: recipientsToString(form.toRecipients),
                  })
                }
                disabled={disabled}>
                <Printer className="size-4" />
              </ToolbarButton>
            </ToolbarGroup>
          )}
        </div>
      </Toolbar>
    </div>
  );
}

/* ─── Format (Markdown / Rich text / Plain) ─── */

/**
 * One control for the composer's three dialects.
 *
 * Markdown is the block editor with its chrome. Rich text is the same
 * document with the chrome off, presented the way a word processor reads.
 * Plain replaces the body with text. The first two are two presentations of
 * one value; only Plain is a different format.
 */
function ComposerFormatDropdown({
  disabled = false,
  dialect,
  onSelectDialect,
}: {
  disabled?: boolean;
  dialect: PlateEmailEditorDialect;
  onSelectDialect?: (dialect: PlateEmailEditorDialect) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
        <ToolbarButton
          tooltip={__("Format", "pressedmail")}
          disabled={disabled}>
          <FileText className={COMPOSER_TOOLBAR_ICON_CLASS} />
          <span className="ml-1 hidden text-xs md:inline">
            {composerDialectLabel(dialect)}
          </span>
          <ChevronDown className="ml-0.5 size-3" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{__("Format", "pressedmail")}</DropdownMenuLabel>
        <DropdownMenuSep />
        <DropdownMenuRadioGroup value={dialect}>
          {PLATE_EMAIL_EDITOR_DIALECTS.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              onSelect={() => {
                if (!disabled) onSelectDialect?.(option);
              }}>
              {composerDialectLabel(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Font Family Dropdown ─── */

function FontFamilyDropdown({ disabled = false }: { disabled?: boolean }) {
  const editor = useEditorRef();
  const activeFontFamily = (editor.api.mark?.("fontFamily") as string) ?? "";
  const activeFont = resolveComposerFontOptionFromFamily(activeFontFamily);
  const triggerLabel =
    activeFont && activeFont.id !== "default"
      ? activeFont.label
      : __("Font", "pressedmail");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
        <ToolbarButton tooltip={__("Font", "pressedmail")} disabled={disabled}>
          <CaseSensitive className={COMPOSER_TOOLBAR_ICON_CLASS} />
          <span className="ml-1 hidden text-xs md:inline">{triggerLabel}</span>
          <ChevronDown className="ml-0.5 size-3" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {FONT_FAMILIES.map((font) => (
          <DropdownMenuItem
            key={font.id}
            onSelect={() => {
              if (disabled) return;
              if (font.cssFontFamily === null) {
                editor.tf.removeMarks("fontFamily");
              } else {
                editor.tf.addMark("fontFamily", font.cssFontFamily);
              }
              editor.tf.focus();
            }}>
            <span style={{ fontFamily: font.cssFontFamily ?? undefined }}>
              {font.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Body Background Popover ─── */

// Compact tab chips with an unmistakable active state: the selected surface
// (Email vs Canvas) fills with the primary color instead of the default
// near-invisible background swap. The dark:* re-assertions out-merge the
// kit trigger's own dark data-active overrides.
const BACKGROUND_TAB_TRIGGER_CLASS =
  "h-6 flex-none px-2.5 py-0 text-xs data-active:bg-primary data-active:text-primary-foreground dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground";

function BodyBackgroundPopover({
  disabled = false,
  bodyBackgroundColor,
  canvasBackgroundColor,
  onSetBodyBackgroundColor,
  onSetCanvasBackgroundColor,
}: {
  disabled?: boolean;
  bodyBackgroundColor?: string;
  canvasBackgroundColor?: string;
  onSetBodyBackgroundColor: (color: string | undefined) => void;
  onSetCanvasBackgroundColor?: (color: string | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
        <ToolbarButton
          tooltip={__("Background color", "pressedmail")}
          disabled={disabled}>
          <PaintRoller className={COMPOSER_TOOLBAR_ICON_CLASS} />
        </ToolbarButton>
      </PopoverTrigger>
      {/* w-auto: the popover hugs the swatch grid, which is the widest child;
          the custom-color editor below it is w-full so everything shares the
          palette's width. */}
      <PressedPopoverContent
        size="menu"
        align="start"
        className="w-auto max-w-[92vw] p-2">
        <Tabs defaultValue="email">
          <TabsList className="h-7! p-0.5">
            <TabsTrigger value="email" className={BACKGROUND_TAB_TRIGGER_CLASS}>
              {__("Email", "pressedmail")}
            </TabsTrigger>
            {onSetCanvasBackgroundColor ? (
              <TabsTrigger
                value="canvas"
                className={BACKGROUND_TAB_TRIGGER_CLASS}>
                {__("Canvas", "pressedmail")}
              </TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="email" className="mt-2">
            <ComposerColorPalette
              level="reduced"
              customEditorLayout="background"
              selectedColor={bodyBackgroundColor}
              onPick={(color) => {
                if (!disabled) onSetBodyBackgroundColor(color);
              }}
              onClear={() => {
                if (!disabled) onSetBodyBackgroundColor(undefined);
              }}
            />
          </TabsContent>
          {onSetCanvasBackgroundColor ? (
            <TabsContent value="canvas" className="mt-2">
              <ComposerColorPalette
                level="reduced"
                customEditorLayout="background"
                selectedColor={canvasBackgroundColor}
                onPick={(color) => {
                  if (!disabled) onSetCanvasBackgroundColor(color);
                }}
                onClear={() => {
                  if (!disabled) onSetCanvasBackgroundColor(undefined);
                }}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </PressedPopoverContent>
    </Popover>
  );
}

/* ─── Signature Dropdown ─── */

function SignatureDropdown({
  signatures,
  form,
  disabled = false,
}: {
  signatures: Signature[];
  form: ComposerToolbarForm;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
        <ToolbarButton
          tooltip={__("Signature", "pressedmail")}
          disabled={disabled}
          data-test="composer-signature-select"
          data-testid="composer-signature-select">
          <PenTool className={COMPOSER_TOOLBAR_ICON_CLASS} />
          <ChevronDown className="ml-0.5 size-3" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>
          {__("Insert signature", "pressedmail")}
        </DropdownMenuLabel>
        <DropdownMenuSep />
        {signatures
          .filter((sig) => sig.is_active)
          .map((sig) => (
            <DropdownMenuItem
              key={sig.id}
              onSelect={() => {
                if (!disabled) form.handleSignatureSelect(sig.id);
              }}
              data-test={`composer-signature-option-${sig.id}`}
              data-testid={`composer-signature-option-${sig.id}`}>
              {sig.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Insert Image Dropdown (Media Library / upload / URL merged) ─── */

function InsertImageDropdown({
  disabled = false,
  canUseMediaLibrary,
  canUpload,
  onImageLibrary,
  onImageUpload,
}: {
  disabled?: boolean;
  canUseMediaLibrary: boolean;
  canUpload: boolean;
  onImageLibrary: () => void;
  onImageUpload: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = React.useState(false);

  const itemClassName =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted";

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (!disabled || !nextOpen) setOpen(nextOpen);
        }}>
        <PopoverTrigger
          asChild
          className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
          <ToolbarButton
            isDropdown
            pressed={open}
            disabled={disabled}
            tooltip={__("Insert image", "pressedmail")}>
            <ImageGlyph className={COMPOSER_TOOLBAR_ICON_CLASS} />
          </ToolbarButton>
        </PopoverTrigger>
        <PressedPopoverContent
          size="menu"
          align="start"
          className="p-1"
          data-test="composer-insert-image-menu">
          {canUseMediaLibrary && (
            <button
              type="button"
              disabled={disabled}
              className={itemClassName}
              onClick={() => {
                if (disabled) return;
                setOpen(false);
                onImageLibrary();
              }}>
              <ImageGlyph className="size-4" />
              <span>{__("From Media Library", "pressedmail")}</span>
            </button>
          )}
          {canUpload && (
            <button
              type="button"
              disabled={disabled}
              className={itemClassName}
              onClick={() => {
                if (disabled) return;
                setOpen(false);
                onImageUpload();
              }}>
              <Upload className="size-4" />
              <span>{__("Upload from computer", "pressedmail")}</span>
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            className={itemClassName}
            onClick={() => {
              if (disabled) return;
              setOpen(false);
              setUrlDialogOpen(true);
            }}>
            <LinkGlyph className="size-4" />
            <span>{__("Insert via URL", "pressedmail")}</span>
          </button>
        </PressedPopoverContent>
      </Popover>

      {!disabled ? (
        <MediaUrlDialog
          nodeType={KEYS.img}
          open={urlDialogOpen}
          onOpenChange={setUrlDialogOpen}
        />
      ) : null}
    </>
  );
}
