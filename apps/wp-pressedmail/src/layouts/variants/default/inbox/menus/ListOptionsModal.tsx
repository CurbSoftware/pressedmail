"use client";

/**
 * List Options Modal
 *
 * Dialog for configuring message list display:
 * - Sorting column (From, Subject, Date)
 * - Sorting order (Ascending, Descending)
 * - List mode (List, Threads)
 *
 * @since 3.0.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Check, X, SlidersHorizontal } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

export interface ListOptions {
  sortColumn: "from" | "subject" | "date";
  sortOrder: "asc" | "desc";
  listMode: "list" | "threads";
  showDetails: boolean;
}

export interface ListOptionsModalProps {
  options: ListOptions;
  onSave: (options: ListOptions) => void;
  className?: string;
}

export function ListOptionsModal({
  options,
  onSave,
  className,
}: ListOptionsModalProps) {
  const [open, setOpen] = React.useState(false);
  const [localOptions, setLocalOptions] = React.useState<ListOptions>({
    ...options,
    showDetails: options.showDetails ?? false,
  });

  // Sync local state when dialog opens
  React.useEffect(() => {
    if (open) {
      setLocalOptions({
        ...options,
        showDetails: options.showDetails ?? false,
      });
    }
  }, [open, options]);

  const handleSave = () => {
    onSave(localOptions);
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalOptions(options);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          aria-label={__("List options", "pressedmail")}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            <DialogTitleRow>
              <SlidersHorizontal />
              <span>{__("List options", "pressedmail")}</span>
            </DialogTitleRow>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {__(
              "Configure message list sorting and display mode",
              "pressedmail",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Sorting column */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label className="text-sm text-right">
              {__("Sorting column", "pressedmail")}
            </Label>
            <Select
              value={localOptions.sortColumn}
              onValueChange={(value: ListOptions["sortColumn"]) =>
                setLocalOptions((prev) => ({ ...prev, sortColumn: value }))
              }>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">
                  {__("Date", "pressedmail")}
                </SelectItem>
                <SelectItem value="from">
                  {__("From", "pressedmail")}
                </SelectItem>
                <SelectItem value="subject">
                  {__("Subject", "pressedmail")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sorting order */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label className="text-sm text-right">
              {__("Sorting order", "pressedmail")}
            </Label>
            <Select
              value={localOptions.sortOrder}
              onValueChange={(value: ListOptions["sortOrder"]) =>
                setLocalOptions((prev) => ({ ...prev, sortOrder: value }))
              }>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">
                  {__("Descending", "pressedmail")}
                </SelectItem>
                <SelectItem value="asc">
                  {__("Ascending", "pressedmail")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* List mode */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label className="text-sm text-right">
              {__("List mode", "pressedmail")}
            </Label>
            <Select
              value={localOptions.listMode}
              onValueChange={(value: ListOptions["listMode"]) =>
                setLocalOptions((prev) => ({ ...prev, listMode: value }))
              }>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">
                  {__("List", "pressedmail")}
                </SelectItem>
                <SelectItem value="threads">
                  {__("Threads", "pressedmail")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label className="text-sm text-right" htmlFor="show-details">
              {__("Details", "pressedmail")}
            </Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-details"
                checked={localOptions.showDetails}
                onCheckedChange={(checked) =>
                  setLocalOptions((prev) => ({
                    ...prev,
                    showDetails: Boolean(checked),
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">
                {__("Show sender email and preview", "pressedmail")}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            {__("Cancel", "pressedmail")}
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {__("Save", "pressedmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
