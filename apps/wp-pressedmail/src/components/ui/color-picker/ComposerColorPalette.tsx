"use client";

import { useCallback, useRef, useState } from "react";
import { __ } from "@wordpress/i18n";
import { Plus, X } from "lucide-react";

import { Button, Input } from "@kit/ui/plugin";

import {
  COMPOSER_CUSTOM_COLOR_COLUMNS,
  COMPOSER_CUSTOM_COLOR_MAX,
  COMPOSER_PALETTE_DEFAULT,
  COMPOSER_RECENT_COLOR_MAX,
  getActivePalette,
  getActiveNeutral,
  type ComposerPaletteLevel,
} from "@/lib/composer-color-palettes";
import { appMessage } from "@/context/toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  isComposerBackgroundColor,
  normalizeComposerBackgroundColor,
} from "@/lib/composer-background-color";
import { isHexColor } from "@/lib/hex-color";
import { isPaletteDisabled } from "@/lib/preference-behavior";
import { cn } from "@/lib/utils";

import { PalettePicker } from "./PalettePicker";

const DEFAULT_DRAFT = "#000000";
export type ComposerColorPaletteMode = "picker" | "preview" | "manager";
export type ComposerCustomEditorLayout = "default" | "background";

export interface ComposerColorPaletteProps {
  /** Fired with a lowercased hex when the user clicks any swatch. */
  onPick: (hex: string) => void;
  /** Fired when the Clear color action is invoked. */
  onClear: () => void;
  /**
   * Settings-page preview renders the same component but disables every
   * interactive affordance (no Add, no swatch clicks, no Clear).
   */
  readOnly?: boolean;
  mode?: ComposerColorPaletteMode;
  className?: string;
  /**
   * Explicit palette level. When set, overrides the user's stored
   * `composer_palette_level`, so several instances can render different sizes
   * side by side (e.g. the settings page showing Full / Reduced / Minimal).
   */
  level?: ComposerPaletteLevel;
  customColors?: string[];
  recentColors?: string[];
  onCustomColorsChange?: (colors: string[]) => void;
  /**
   * When false, the two custom-color columns (and the Add affordance) are
   * hidden. Used for the Reduced/Minimal settings previews where custom colors
   * live only under the Full palette.
   */
  showCustomColumns?: boolean;
  /**
   * Opt-in composer-background editor. Keeps the palette above a responsive
   * visual + Hex/RGBA editor without changing other palette consumers.
   */
  customEditorLayout?: ComposerCustomEditorLayout;
  /** Currently applied target color, used for live preview rollback. */
  selectedColor?: string;
}

/**
 * Append `hex` to a recent-colors list with FIFO behavior and a cap.
 * Pure helper exported for direct testing.
 */
export function pushRecentColor(
  list: ReadonlyArray<string>,
  hex: string,
  cap: number = COMPOSER_RECENT_COLOR_MAX,
): string[] {
  const normalized = hex.trim().toLowerCase();
  if (!isHexColor(normalized)) {
    return [...list];
  }
  const filtered = list.filter((entry) => entry !== normalized);
  return [normalized, ...filtered].slice(0, cap);
}

interface SwatchProps {
  hex: string;
  onPick: (hex: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

function Swatch({ hex, onPick, ariaLabel, disabled, className }: SwatchProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? hex}
      onClick={() => {
        if (disabled) return;
        onPick(hex);
      }}
      disabled={disabled}
      className={cn(
        "relative size-4.5 rounded-sm border border-input transition-transform after:absolute after:-inset-1 after:content-['']",
        !disabled && "hover:scale-110",
        className,
      )}
      style={{ backgroundColor: hex }}
    />
  );
}

export function ComposerColorPalette({
  onPick,
  onClear,
  readOnly = false,
  mode = "picker",
  className,
  level,
  customColors: controlledCustomColors,
  recentColors: controlledRecentColors,
  onCustomColorsChange,
  showCustomColumns = true,
  customEditorLayout = "default",
  selectedColor,
}: ComposerColorPaletteProps) {
  const { preferences, updatePreferences } = useUserPreferences();
  const customColors =
    controlledCustomColors ?? preferences.palette_custom_colors ?? [];
  const recentColors =
    controlledRecentColors ?? preferences.palette_recent_colors ?? [];
  // Active density level (an explicit `level` prop overrides the stored
  // preference). The locked grid, the grayscale ramp, and the custom columns
  // all follow the same shade count, so every column has matching height.
  const resolvedLevel = level ?? preferences.composer_palette_level;
  const { hues: activeHues, shades: activeShades } =
    getActivePalette(resolvedLevel);
  const visibleHues =
    mode === "manager"
      ? activeHues
      : activeHues.filter(
          (hue) => !isPaletteDisabled(hue, preferences.disabled_palettes ?? []),
        );
  const activeNeutral = getActiveNeutral(resolvedLevel);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  // The custom editor takes the swatch grid's place, so it also takes its
  // width, measured at the moment we swap, since the grid is intrinsically
  // sized and unmounts on open. Keeps the surrounding popovers (all w-auto)
  // from jumping sideways.
  const swatchAreaRef = useRef<HTMLDivElement>(null);
  const [swapWidth, setSwapWidth] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [previousAppliedColor, setPreviousAppliedColor] = useState<
    string | undefined
  >(undefined);

  const effectiveMode: ComposerColorPaletteMode = readOnly ? "preview" : mode;
  const isPreview = effectiveMode === "preview";
  const isManager = effectiveMode === "manager";
  const isPicker = effectiveMode === "picker";
  const isBackgroundEditor = customEditorLayout === "background";
  // COMPOSER_CUSTOM_COLOR_MAX is derived from the full 11-shade grid (22), but
  // every composer popover renders the reduced 7-shade one, which only draws 14
  // slots. Picker additions follow that grid; the settings manager can still
  // curate all 22 saved colors at any density.
  const customSlotCount = activeShades.length * COMPOSER_CUSTOM_COLOR_COLUMNS;
  const canAddCustom =
    !isPreview &&
    customColors.length <
      (isManager
        ? COMPOSER_CUSTOM_COLOR_MAX
        : Math.min(customSlotCount, COMPOSER_CUSTOM_COLOR_MAX));
  const customRowCount = isManager
    ? Math.max(
        activeShades.length,
        Math.ceil(
          (customColors.length + (canAddCustom ? 1 : 0)) /
            COMPOSER_CUSTOM_COLOR_COLUMNS,
        ),
      )
    : activeShades.length;
  const showCustomEditor = !isPreview && draftOpen;

  const handleSwatch = useCallback(
    (hex: string) => {
      if (!isPicker) return;
      onPick(hex);
    },
    [isPicker, onPick],
  );

  const normalizedDraft = draft.trim().toLowerCase();
  const normalizedBackgroundDraft = normalizeComposerBackgroundColor(draft);
  const duplicateIndex = customColors.findIndex(
    (entry) => entry === normalizedDraft,
  );
  const draftIsDuplicate =
    duplicateIndex !== -1 && duplicateIndex !== editingIndex;
  const draftValid =
    (isBackgroundEditor
      ? Boolean(normalizedBackgroundDraft)
      : isHexColor(normalizedDraft)) &&
    // The settings manager curates the list, so a duplicate there is a real
    // mistake worth refusing. A picker is being asked for a colour: if the user
    // lands on one already saved, apply it rather than disabling Save with no
    // explanation, which is indistinguishable from the button being broken.
    (isBackgroundEditor || isPicker || !draftIsDuplicate);

  function captureSwapWidth() {
    const measured = swatchAreaRef.current?.offsetWidth ?? 0;
    setSwapWidth(measured > 0 ? measured : null);
  }

  function commitDraft() {
    if (!draftValid) return;
    const nextColors = draftIsDuplicate
      ? [...customColors]
      : editingIndex === null
        ? [...customColors, normalizedDraft]
        : customColors.map((entry, index) =>
            index === editingIndex ? normalizedDraft : entry,
          );

    if (isBackgroundEditor) {
      const nextRecentColors = pushRecentColor(recentColors, normalizedDraft);
      if (onCustomColorsChange) {
        onCustomColorsChange(nextColors);
        void updatePreferences({ palette_recent_colors: nextRecentColors });
      } else {
        void updatePreferences({
          palette_custom_colors: nextColors,
          palette_recent_colors: nextRecentColors,
        });
      }
      onPick(normalizedDraft);
    } else if (onCustomColorsChange) {
      onCustomColorsChange(nextColors);
      if (isPicker) {
        onPick(normalizedDraft);
      }
    } else {
      void Promise.resolve(
        updatePreferences({
          palette_custom_colors: nextColors,
        }),
      ).then((didSave) => {
        if (!didSave) {
          // A rejected save rolls the optimistic state back, so without this
          // the new colour just disappeared and the palette looked unchanged.
          appMessage(__("Could not save that color", "pressedmail"), "error");
          return;
        }
        if (isManager) {
          appMessage(__("Custom colors updated", "pressedmail"), "success");
        }
      });
      // Saving a colour the user just built should also select it, otherwise
      // Save only files a swatch away and the tag/calendar/flag/list dialogs
      // keep whatever was chosen before.
      if (isPicker) {
        onPick(normalizedDraft);
      }
    }
    setDraftOpen(false);
    setEditingIndex(null);
    setPreviousAppliedColor(undefined);
    setDraft(DEFAULT_DRAFT);
  }

  function removeCustom(hex: string) {
    const nextColors = customColors.filter((entry) => entry !== hex);

    if (onCustomColorsChange) {
      onCustomColorsChange(nextColors);
      return;
    }

    void Promise.resolve(
      updatePreferences({
        palette_custom_colors: nextColors,
      }),
    ).then((didSave) => {
      if (didSave && isManager) {
        appMessage(__("Custom colors updated", "pressedmail"), "success");
      }
    });
  }

  const clearRecentColors = useCallback(() => {
    void updatePreferences({ palette_recent_colors: [] });
  }, [updatePreferences]);

  function cancelDraft() {
    setDraftOpen(false);
    setEditingIndex(null);
    setDraft(DEFAULT_DRAFT);
    if (isBackgroundEditor) {
      if (previousAppliedColor) {
        onPick(previousAppliedColor);
      } else {
        onClear();
      }
    }
    setPreviousAppliedColor(undefined);
  }

  function startAdding() {
    if (draftOpen && editingIndex === null) {
      cancelDraft();
      return;
    }

    const normalizedSelectedColor = selectedColor?.trim().toLowerCase();
    setPreviousAppliedColor(
      normalizedSelectedColor &&
        isComposerBackgroundColor(normalizedSelectedColor)
        ? normalizedSelectedColor
        : undefined,
    );
    setDraft(
      isBackgroundEditor &&
        normalizedSelectedColor &&
        isComposerBackgroundColor(normalizedSelectedColor)
        ? normalizedSelectedColor
        : DEFAULT_DRAFT,
    );
    setEditingIndex(null);
    captureSwapWidth();
    setDraftOpen(true);
  }

  function startEditing(index: number, hex: string) {
    if (!isManager) {
      handleSwatch(hex);
      return;
    }

    const normalizedSelectedColor =
      normalizeComposerBackgroundColor(selectedColor);
    setDraft(hex);
    setEditingIndex(index);
    setPreviousAppliedColor(normalizedSelectedColor);
    captureSwapWidth();
    setDraftOpen(true);
  }

  function handleDraftChange(nextDraft: string) {
    setDraft(nextDraft);
    const normalized = normalizeComposerBackgroundColor(nextDraft);
    if (isBackgroundEditor && normalized) {
      onPick(normalized);
    }
  }

  return (
    <div className={cn("space-y-2 p-1", className)}>
      {/*
        The custom editor opens IN PLACE of the swatches. Either the grid or
        the picker is mounted, never both, so the surface keeps one footprint
        instead of growing a second panel beside it.
      */}
      <div
        data-test="composer-color-palette-add-row"
        data-testid="composer-color-palette-add-row"
        className="flex flex-col gap-3">
        {!showCustomEditor ? (
          <div
            ref={swatchAreaRef}
            role="region"
            aria-label={__("Composer color swatches", "pressedmail")}
            tabIndex={0}
            className="max-w-full min-w-0 overflow-x-auto pb-1">
            <div
              data-test="composer-color-palette-grid"
              data-testid="composer-color-palette-grid"
              className="grid w-max gap-1"
              style={{
                gridTemplateColumns: showCustomColumns
                  ? `repeat(${visibleHues.length}, max-content) auto repeat(${COMPOSER_CUSTOM_COLOR_COLUMNS}, auto)`
                  : `repeat(${visibleHues.length}, max-content) auto`,
              }}>
              {/* Locked Tailwind columns (density-aware) */}
              {visibleHues.map((hue) => (
                <div
                  key={hue}
                  data-test="composer-color-palette-hue-column"
                  data-testid="composer-color-palette-hue-column"
                  className="flex flex-col gap-0.5">
                  {activeShades.map((shade) => {
                    const hex = COMPOSER_PALETTE_DEFAULT[hue][shade];
                    return (
                      <Swatch
                        key={`${hue}-${shade}`}
                        hex={hex}
                        onPick={handleSwatch}
                        disabled={!isPicker}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Grayscale neutral column (density-aware: 11 / 5 / 3) */}
              <div
                data-test="composer-color-palette-neutral-column"
                data-testid="composer-color-palette-neutral-column"
                className="ml-1 flex flex-col gap-0.5 border-l border-border pl-1">
                {activeNeutral.map((hex) => (
                  <Swatch
                    key={`neutral-${hex}`}
                    hex={hex}
                    onPick={handleSwatch}
                    disabled={!isPicker}
                  />
                ))}
              </div>

              {/* Custom columns */}
              {showCustomColumns &&
                Array.from({ length: COMPOSER_CUSTOM_COLOR_COLUMNS }).map(
                  (_, columnIndex) => (
                    <div
                      key={`custom-column-${columnIndex}`}
                      data-test="composer-color-palette-custom-column"
                      data-testid="composer-color-palette-custom-column"
                      className="flex flex-col gap-0.5 border-l border-border pl-1">
                      {Array.from({ length: customRowCount }).map(
                        (_, rowIndex) => {
                          const customIndex =
                            columnIndex * customRowCount + rowIndex;
                          const hex = customColors[customIndex];
                          if (hex) {
                            return (
                              <div
                                key={`custom-${customIndex}`}
                                className="group relative">
                                <Swatch
                                  hex={hex}
                                  ariaLabel={
                                    isManager
                                      ? `${__("Edit", "pressedmail")} ${hex}`
                                      : hex
                                  }
                                  onPick={() => startEditing(customIndex, hex)}
                                  disabled={isPreview}
                                />
                                {!isPreview && (
                                  <button
                                    type="button"
                                    aria-label={`${__(
                                      "Remove",
                                      "pressedmail",
                                    )} ${hex}`}
                                    onClick={() => removeCustom(hex)}
                                    className="absolute -right-1 -top-1 hidden h-3 w-3 items-center justify-center rounded-full border border-input bg-background text-foreground shadow-xs after:absolute after:-inset-1.5 after:content-[''] group-hover:flex group-focus-within:flex">
                                    <X className="h-2 w-2" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            );
                          }
                          if (
                            customIndex === customColors.length &&
                            canAddCustom
                          ) {
                            return (
                              <button
                                key={`custom-add-${customIndex}`}
                                type="button"
                                aria-label={__(
                                  "Add custom color",
                                  "pressedmail",
                                )}
                                onClick={startAdding}
                                className="relative flex size-4.5 items-center justify-center rounded-sm border border-dashed border-input text-muted-foreground after:absolute after:-inset-1 after:content-[''] hover:bg-muted">
                                <Plus className="h-3 w-3" aria-hidden="true" />
                              </button>
                            );
                          }
                          return (
                            <div
                              key={`custom-slot-${customIndex}`}
                              className="size-4.5 rounded-sm border border-dashed border-input/40"
                            />
                          );
                        },
                      )}
                    </div>
                  ),
                )}
            </div>
          </div>
        ) : (
          <PalettePicker
            value={draft}
            onChange={handleDraftChange}
            layout={customEditorLayout}
            style={swapWidth ? { width: swapWidth } : undefined}
            className={cn(!swapWidth && "w-full")}>
            {isManager && !isBackgroundEditor && (
              <>
                <label className="flex items-center gap-2 text-xs">
                  <span className="font-medium">
                    {__("Hex value", "pressedmail")}
                  </span>
                  <Input
                    autoComplete="off"
                    type="text"
                    aria-label={__("Hex value", "pressedmail")}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="flex-1 px-2 text-xs"
                  />
                </label>
                {!isHexColor(normalizedDraft) &&
                  draft !== DEFAULT_DRAFT && (
                    <p className="text-xs text-destructive">
                      {__(
                        "Enter a valid hex color like #ff8800.",
                        "pressedmail",
                      )}
                    </p>
                  )}
                {isHexColor(normalizedDraft) &&
                  duplicateIndex !== -1 &&
                  duplicateIndex !== editingIndex && (
                    <p className="text-xs text-destructive">
                      {__(
                        "That color is already in the palette.",
                        "pressedmail",
                      )}
                    </p>
                  )}
              </>
            )}
            {isBackgroundEditor && !draftValid ? (
              <p role="alert" className="text-xs text-destructive">
                {__("Enter a 6 or 8 digit hex color.", "pressedmail")}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={commitDraft}
                disabled={!draftValid}>
                {__("Save color", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelDraft}>
                {__("Cancel", "pressedmail")}
              </Button>
            </div>
          </PalettePicker>
        )}
      </div>

      {isPicker && (
        <>
          <hr className="my-1 border-border" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded px-2 py-1 text-xs hover:bg-muted">
              {__("Clear Color", "pressedmail")}
            </button>
            <button
              type="button"
              onClick={clearRecentColors}
              disabled={recentColors.length === 0}
              className="shrink-0 rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
              {__("Clear History", "pressedmail")}
            </button>
            {recentColors.length > 0 && (
              <div
                data-test="composer-color-palette-recents"
                data-testid="composer-color-palette-recents"
                className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                {recentColors.map((hex) => (
                  <Swatch
                    key={hex}
                    hex={hex}
                    onPick={handleSwatch}
                    disabled={!isPicker}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!isPicker && recentColors.length > 0 && (
        <div
          data-test="composer-color-palette-recents"
          data-testid="composer-color-palette-recents"
          className="flex items-center gap-1">
          {recentColors.map((hex) => (
            <Swatch
              key={hex}
              hex={hex}
              onPick={handleSwatch}
              disabled={!isPicker}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ComposerColorPalette;
