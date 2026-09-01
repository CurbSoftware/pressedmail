"use client";

import * as React from "react";
import type { Value } from "@kit/plate";
import { ArrowUpDown, Upload } from "lucide-react";
import { useEditorRef } from "@kit/plate/react";

import { __ } from "@wordpress/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Textarea,
} from "@kit/ui/plugin";

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from "@/components/composer/toolbar";
import { appMessage } from "@/context/toast";
import {
  type ComposerImportResult,
  deserializeComposerHtmlToPlateValue,
  deserializeComposerMarkdownToImportResult,
  serializePlateValueToMarkdown,
  serializePlateValueToEditableHtml,
} from "@/lib/composer/composer-serialization";

type ImportKind = "html" | "markdown";

function downloadTextFile(
  contents: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ImportExportToolbarButton({
  bodyBackgroundColor,
  onBodyBackgroundColorChange,
}: {
  bodyBackgroundColor?: string;
  onBodyBackgroundColorChange?: (color: string | undefined) => void;
}) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const [importKind, setImportKind] = React.useState<ImportKind | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pendingImport, setPendingImport] =
    React.useState<ComposerImportResult | null>(null);
  const importGenerationRef = React.useRef(0);

  React.useEffect(
    () => () => {
      importGenerationRef.current += 1;
    },
    [],
  );

  const closeImportDialog = () => {
    importGenerationRef.current += 1;
    setImportKind(null);
    setDraft("");
    setBusy(false);
    setPendingImport(null);
  };

  const applyImport = (
    value: Value,
    bodyBackground?: string,
    applyBackground = false,
  ) => {
    editor.tf.setValue(value);
    if (applyBackground) onBodyBackgroundColorChange?.(bodyBackground);
    editor.tf.focus();
    appMessage(__("Composer content imported.", "pressedmail"), "success");
    closeImportDialog();
  };

  const runImport = async () => {
    if (!importKind || !draft.trim()) {
      appMessage(__("Paste content before importing.", "pressedmail"), "error");
      return;
    }

    // No native window.confirm gate here: inside the plugin's portal context
    // it can be suppressed and silently abort the import, and the dialog copy
    // plus the explicit Import button already confirm the replacement.
    setBusy(true);
    const importGeneration = importGenerationRef.current + 1;
    importGenerationRef.current = importGeneration;
    try {
      if (importKind === "html") {
        if (pendingImport) {
          applyImport(
            pendingImport.value,
            pendingImport.bodyBackgroundColor,
            true,
          );
          return;
        }

        const result = await deserializeComposerHtmlToPlateValue(
          draft,
          editor.api.html,
        );
        if (importGeneration !== importGenerationRef.current) return;
        if (result.warnings.length > 0) {
          setPendingImport(result);
          setBusy(false);
          return;
        }

        applyImport(result.value, result.bodyBackgroundColor, true);
        return;
      }

      if (pendingImport) {
        applyImport(pendingImport.value);
        return;
      }

      const result = await deserializeComposerMarkdownToImportResult(draft);
      if (importGeneration !== importGenerationRef.current) return;
      if (result.warnings.length > 0) {
        setPendingImport(result);
        setBusy(false);
        return;
      }
      applyImport(result.value);
    } catch {
      if (importGeneration !== importGenerationRef.current) return;
      setBusy(false);
      appMessage(
        __(
          "Could not import this content. Existing content was preserved.",
          "pressedmail",
        ),
        "error",
      );
    }
  };

  const exportHtml = async () => {
    try {
      const html = await serializePlateValueToEditableHtml(
        editor.children as Value,
        { bodyBackgroundColor },
      );
      downloadTextFile(html, "message.html", "text/html");
      appMessage(__("Composer HTML exported.", "pressedmail"), "success");
    } catch {
      appMessage(__("Could not export HTML.", "pressedmail"), "error");
    }
  };

  const exportMarkdown = async () => {
    try {
      const markdown = await serializePlateValueToMarkdown(
        editor.children as Value,
      );
      downloadTextFile(markdown, "message.md", "text/markdown");
      appMessage(__("Composer Markdown exported.", "pressedmail"), "success");
    } catch {
      appMessage(__("Could not export Markdown.", "pressedmail"), "error");
    }
  };

  const importTitle =
    importKind === "markdown"
      ? __("Import Markdown", "pressedmail")
      : __("Import HTML", "pressedmail");

  return (
    <>
      <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger
          asChild
          className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}>
          <ToolbarButton
            isDropdown
            pressed={open}
            tooltip={__("Import or export composer content", "pressedmail")}>
            <ArrowUpDown className={COMPOSER_TOOLBAR_ICON_CLASS} />
          </ToolbarButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => {
                setDraft("");
                setPendingImport(null);
                setImportKind("html");
              }}>
              {__("Import HTML", "pressedmail")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setDraft("");
                setPendingImport(null);
                setImportKind("markdown");
              }}>
              {__("Import Markdown", "pressedmail")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportHtml()}>
              {__("Export HTML", "pressedmail")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportMarkdown()}>
              {__("Export Markdown", "pressedmail")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={importKind !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeImportDialog();
        }}>
        <DialogContent className="max-w-[min(92vw,42rem)]">
          <DialogHeader>
            <DialogTitle>
              <DialogTitleRow>
                <Upload />
                <span>{importTitle}</span>
              </DialogTitleRow>
            </DialogTitle>
            <DialogDescription>
              {pendingImport
                ? __(
                    "Some formatting must be simplified. Review the warnings, then choose Import anyway to replace the current body.",
                    "pressedmail",
                  )
                : __(
                    "Paste content to replace the current composer body.",
                    "pressedmail",
                  )}
            </DialogDescription>
          </DialogHeader>
          {pendingImport ? (
            <div
              className="border-border bg-muted/40 text-foreground rounded-md border p-3 text-sm"
              role="alert">
              <p className="font-medium">
                {__("Import warnings", "pressedmail")}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {pendingImport.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Textarea
            autoComplete="off"
            aria-label={importTitle}
            className="min-h-60 font-mono text-xs"
            disabled={busy}
            value={draft}
            onChange={(event) => {
              importGenerationRef.current += 1;
              setDraft(event.target.value);
              setPendingImport(null);
              setBusy(false);
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeImportDialog}
              disabled={busy}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              onClick={() => void runImport()}
              disabled={busy}>
              {pendingImport
                ? __("Import anyway", "pressedmail")
                : __("Import", "pressedmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
