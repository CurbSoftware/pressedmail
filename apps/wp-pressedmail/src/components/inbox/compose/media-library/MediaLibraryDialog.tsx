/**
 * Custom composer Media Library popup.
 *
 * Replaces the default (unreliable) wp.media frame: lists the CURRENT USER's own
 * uploads from `GET /attachments/media-library`, lets them pick image(s) to embed
 * inline or file(s) to attach, and resolves the same selection shape the old
 * wp.media path returned so downstream insert/attach logic is unchanged.
 */

import { __ } from "@wordpress/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Input,
  Label,
  ScrollArea,
} from "@kit/ui/plugin";
import { Check, FileIcon, ImageIcon, Loader2, Search } from "lucide-react";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayError,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { cn } from "@/lib/utils";
import {
  listMediaLibrary,
  type MediaPickerSelection,
} from "@/services/media-library.service";

export interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `image` shows images only; `all` shows every allowed type. */
  mode: "image" | "all";
  multiple?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (selected: MediaPickerSelection[]) => void;
}

const PER_PAGE = 40;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

function isImage(item: MediaPickerSelection): boolean {
  return item.mimeType.startsWith("image/");
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  mode,
  multiple = true,
  title,
  description,
  confirmLabel,
  onConfirm,
}: MediaLibraryDialogProps) {
  const [items, setItems] = useState<MediaPickerSelection[]>([]);
  const [selectedItemsById, setSelectedItemsById] = useState<
    Map<number, MediaPickerSelection>
  >(() => new Map());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<{
    page: number;
    term: string;
  } | null>(null);
  // Guard against out-of-order responses when search/page change quickly.
  const requestSeq = useRef(0);

  // Every open/close transition starts a distinct request and selection
  // session. The cleanup also invalidates requests that settle after unmount.
  useEffect(() => {
    requestSeq.current += 1;
    setItems([]);
    setSelectedItemsById(new Map());
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setHasMore(false);
    setLoading(false);
    setError(null);
    setFailedRequest(null);

    return () => {
      requestSeq.current += 1;
    };
  }, [open]);

  // Debounce the search box.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [open, search]);

  // Reset to page 1 whenever the search term settles.
  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [debouncedSearch, open]);

  const load = useCallback(
    async (pageToLoad: number, term: string) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      setFailedRequest(null);
      try {
        const result = await listMediaLibrary({
          type: mode,
          search: term,
          page: pageToLoad,
          perPage: PER_PAGE,
        });
        if (seq !== requestSeq.current) return;
        setItems((prev) =>
          pageToLoad === 1 ? result.items : [...prev, ...result.items],
        );
        setHasMore(result.hasMore);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setFailedRequest({ page: pageToLoad, term });
        setError(
          err instanceof Error
            ? err.message
            : __("Could not load your media.", "pressedmail"),
        );
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    if (open) {
      void load(page, debouncedSearch);
    }
  }, [open, page, debouncedSearch, load]);

  const toggle = useCallback(
    (item: MediaPickerSelection) => {
      setSelectedItemsById((previousItems) => {
        if (previousItems.has(item.id)) {
          const nextItems = new Map(previousItems);
          nextItems.delete(item.id);
          return nextItems;
        }

        if (!multiple) {
          return new Map([[item.id, item]]);
        }

        return new Map(previousItems).set(item.id, item);
      });
    },
    [multiple],
  );

  const selectedItems = useMemo(
    () => Array.from(selectedItemsById.values()),
    [selectedItemsById],
  );

  const handleConfirm = () => {
    if (selectedItems.length === 0) return;
    onConfirm(selectedItems);
    onOpenChange(false);
  };

  const resolvedTitle =
    title ??
    (mode === "image"
      ? __("Insert image from your media", "pressedmail")
      : __("Attach from your media", "pressedmail"));
  const resolvedConfirm =
    confirmLabel ??
    (mode === "image"
      ? __("Insert", "pressedmail")
      : __("Attach", "pressedmail"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PressedDialogContent
        size="picker"
        className="flex max-h-[min(calc(100dvh-2rem),80dvh)] flex-col">
        <PressedDialogHeader
          icon={mode === "image" ? ImageIcon : FileIcon}
          title={resolvedTitle}
          description={
            description ??
            __("Choose media from your WordPress library.", "pressedmail")
          }
          descriptionMode={description ? "visible" : "sr-only"}
        />

        <PressedOverlayBody className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="relative shrink-0">
            <Label htmlFor="media-library-search" className="sr-only">
              {__("Search Media Library", "pressedmail")}
            </Label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            />
            <Input autoComplete="off"
              id="media-library-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={__("Search your media…", "pressedmail")}
              className="pl-8"
            />
          </div>

          <ScrollArea
            className="max-h-[min(21.25rem,50dvh)] min-h-[10rem] flex-1 pr-2"
            data-test="media-library-grid">
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <PressedOverlayError>{error}</PressedOverlayError>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const request = failedRequest ?? {
                      page: 1,
                      term: debouncedSearch,
                    };
                    void load(request.page, request.term);
                  }}>
                  {__("Try again", "pressedmail")}
                </Button>
              </div>
            ) : items.length === 0 && !loading ? (
              <div
                role="status"
                className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {__("No media found.", "pressedmail")}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((item) => {
                  const selected = selectedItemsById.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item)}
                      aria-pressed={selected}
                      title={item.filename}
                      data-test="media-library-item"
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card-surface text-left transition hover:border-primary/50",
                        selected && "border-primary ring-2 ring-primary",
                      )}>
                      <div className="flex aspect-square items-center justify-center bg-muted/40">
                        {isImage(item) ? (
                          <img
                            src={item.thumbnail || item.url}
                            alt={item.filename}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                        {selected ? (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate px-1.5 py-1 text-[11px]">
                        <span className="block truncate">{item.filename}</span>
                        {item.size ? (
                          <span className="text-muted-foreground">
                            {formatBytes(item.size)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                {__("Loading…", "pressedmail")}
              </div>
            ) : hasMore ? (
              <div className="flex justify-center py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}>
                  {__("Load more", "pressedmail")}
                </Button>
              </div>
            ) : null}
          </ScrollArea>
        </PressedOverlayBody>

        <PressedOverlayFooter className="sticky bottom-0 z-10 shrink-0 items-center justify-between bg-popover sm:justify-between">
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-muted-foreground">
            {selectedItems.length > 0 ? (
              <Badge variant="secondary">
                {selectedItems.length} {__("selected", "pressedmail")}
              </Badge>
            ) : null}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={selectedItems.length === 0}
              data-test="media-library-confirm">
              {resolvedConfirm}
            </Button>
          </div>
        </PressedOverlayFooter>
      </PressedDialogContent>
    </Dialog>
  );
}
