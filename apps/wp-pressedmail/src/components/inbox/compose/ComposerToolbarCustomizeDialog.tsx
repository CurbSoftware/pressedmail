import { useMemo, useState } from "react";
import { __ } from "@wordpress/i18n";
import { Sliders } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  Label,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from "@kit/ui/plugin";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useComposerPalettesEnabled } from "@/hooks/useComposerPalettesEnabled";
import type {
  ComposerToolbarItemId,
  UserPreferences,
} from "@/hooks/useUserPreferences";

import type { ComposerAuthoringSurface } from "./ComposerEditorToolbar";
import {
  ALL_COMPOSER_TOOLBAR_ITEM_IDS,
  COMPOSER_AI_TOOLBAR_ENABLED,
  DEFAULT_COMPOSER_TOOLBAR_ITEMS,
  DEFAULT_COMPOSER_MOBILE_TOOLBAR_ITEMS,
  getComposerToolbarSettingsGroups,
  resolveComposerToolbarItems,
} from "./composer-toolbar-registry";

/** Toolbar items that open a composer color palette (Ultimate tier). */
const PALETTE_TOOLBAR_ITEM_IDS = new Set<ComposerToolbarItemId>([
  "text_color",
  "highlight_color",
  "body_background",
]);

type ComposerToolbarPreferences = Pick<
  UserPreferences,
  | "composer_toolbar_preset"
  | "composer_toolbar_items"
  | "composer_mobile_toolbar_preset"
  | "composer_mobile_toolbar_items"
>;

export interface ComposerToolbarCustomizeDialogProps {
  /** The composer surface the toolbar is rendered on. */
  surface?: ComposerAuthoringSurface;
  /**
   * Whether AI controls can actually be turned on (AI enabled AND configured).
   * When false, AI functions are still listed but rendered as disabled, off
   * toggles.
   */
  aiInteractive?: boolean;
  contentBlocksEnabled?: boolean;
  inlineImagesEnabled?: boolean;
  /** Which persisted toolbar preference set this dialog edits. */
  target?: "desktop" | "mobile";
  triggerClassName?: string;
  /** Optional Preferences-page draft; composer surfaces use persisted values. */
  toolbarPreferences?: ComposerToolbarPreferences;
  /** Stages changes in the Preferences-page draft instead of persisting them. */
  onToolbarPreferencesChange?: (
    updates: Partial<ComposerToolbarPreferences>,
  ) => void;
}

/**
 * In-composer toolbar customization.
 *
 * A toolbar button opens a dialog listing every toolbar function available on
 * the current surface as a toggle. Toggling writes the shared
 * `composer_toolbar_preset='custom'` + `composer_toolbar_items` preference that
 * every composer reads. Preview is always listed, checked, and locked on (it
 * cannot be removed). AI functions are always listed but stay deactivated until
 * AI is enabled and configured.
 */
export function ComposerToolbarCustomizeDialog({
  surface = "email",
  aiInteractive = COMPOSER_AI_TOOLBAR_ENABLED,
  contentBlocksEnabled = false,
  inlineImagesEnabled = true,
  target = "desktop",
  triggerClassName,
  toolbarPreferences,
  onToolbarPreferencesChange,
}: ComposerToolbarCustomizeDialogProps) {
  const { preferences, updatePreferences, saving } = useUserPreferences();
  const effectivePreferences = toolbarPreferences ?? preferences;
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<"desktop" | "mobile">(
    target,
  );
  const isMobileTarget = selectedTarget === "mobile";
  const palettesEnabled = useComposerPalettesEnabled();

  // List every function available on this surface. AI is force-listed
  // (aiEnabled: true) so it always appears; its interactivity is handled below.
  // The palette buttons are dropped outright when the Ultimate tier is absent,
  // so nobody can toggle on a button the toolbar refuses to render.
  const groups = useMemo(
    () =>
      getComposerToolbarSettingsGroups({
        surface,
        contentBlocksEnabled,
        inlineImagesEnabled,
        aiEnabled: true,
      })
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => palettesEnabled || !PALETTE_TOOLBAR_ITEM_IDS.has(item.id),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [surface, contentBlocksEnabled, inlineImagesEnabled, palettesEnabled],
  );
  const groupColumns = useMemo(() => {
    const midpoint = Math.ceil(groups.length / 2);
    return [groups.slice(0, midpoint), groups.slice(midpoint)];
  }, [groups]);

  const selectedItems = useMemo(
    () =>
      resolveComposerToolbarItems(
        isMobileTarget
          ? effectivePreferences.composer_mobile_toolbar_preset
          : effectivePreferences.composer_toolbar_preset,
        isMobileTarget
          ? effectivePreferences.composer_mobile_toolbar_items
          : effectivePreferences.composer_toolbar_items,
        {
          surface,
          contentBlocksEnabled,
          inlineImagesEnabled,
          aiEnabled: aiInteractive,
        },
      ),
    [
      aiInteractive,
      contentBlocksEnabled,
      inlineImagesEnabled,
      isMobileTarget,
      effectivePreferences.composer_mobile_toolbar_items,
      effectivePreferences.composer_mobile_toolbar_preset,
      effectivePreferences.composer_toolbar_items,
      effectivePreferences.composer_toolbar_preset,
      surface,
    ],
  );

  const applyToolbarPreferences = (
    updates: Partial<ComposerToolbarPreferences>,
  ) => {
    if (onToolbarPreferencesChange) {
      onToolbarPreferencesChange(updates);
      return;
    }

    void updatePreferences(updates);
  };

  const toggleItem = (itemId: ComposerToolbarItemId, checked: boolean) => {
    // Preview is non-removable; ignore attempts to turn it off.
    if (itemId === "preview") return;

    const next = new Set(selectedItems);
    next.add("preview");
    if (checked) {
      next.add(itemId);
    } else {
      next.delete(itemId);
    }

    const nextItems = ALL_COMPOSER_TOOLBAR_ITEM_IDS.filter((id) =>
      next.has(id),
    );
    applyToolbarPreferences(
      isMobileTarget
        ? {
            composer_mobile_toolbar_preset: "custom",
            composer_mobile_toolbar_items: nextItems,
          }
        : {
            composer_toolbar_preset: "custom",
            composer_toolbar_items: nextItems,
          },
    );
  };

  const resetToDefault = () => {
    applyToolbarPreferences(
      isMobileTarget
        ? {
            composer_mobile_toolbar_preset: "recommended_mobile",
            composer_mobile_toolbar_items:
              DEFAULT_COMPOSER_MOBILE_TOOLBAR_ITEMS,
          }
        : {
            composer_toolbar_preset: "standard",
            composer_toolbar_items: DEFAULT_COMPOSER_TOOLBAR_ITEMS,
          },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 w-7 p-0", triggerClassName)}
        aria-label={__("Customize toolbar", "pressedmail")}
        data-test="composer-toolbar-customize-trigger"
        onClick={() => setOpen(true)}>
        <Sliders className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-[min(82vh,42rem)] max-w-[min(92vw,42rem)] grid-rows-[2rem_auto_minmax(0,1fr)_auto] overflow-x-hidden"
          data-test="composer-toolbar-customize-dialog">
          <DialogHeader className="min-h-0 overflow-hidden">
            <DialogTitle>
              <DialogTitleRow>
                <Sliders />
                <span>
                  {isMobileTarget
                    ? __("Customize mobile toolbar", "pressedmail")
                    : __("Customize desktop toolbar", "pressedmail")}
                </span>
              </DialogTitleRow>
            </DialogTitle>
          </DialogHeader>
          <Tabs
            value={selectedTarget}
            onValueChange={(value) =>
              setSelectedTarget(value === "mobile" ? "mobile" : "desktop")
            }
            className="min-w-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="desktop">
                {__("Desktop", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger value="mobile">
                {__("Mobile", "pressedmail")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div
            data-test="composer-toolbar-customize-grid"
            className="grid min-h-0 min-w-0 gap-4 overflow-x-hidden overflow-y-auto pr-1 sm:grid-cols-2">
            {groupColumns.map((columnGroups, columnIndex) => (
              <div key={columnIndex} className="min-w-0 space-y-4">
                {columnGroups.map((group) => (
                  <div key={group.id} className="min-w-0 space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const forced = item.id === "preview";
                        const isAi = item.id === "ai";
                        const disabled =
                          saving || forced || (isAi && !aiInteractive);
                        const checked = forced
                          ? true
                          : isAi
                            ? aiInteractive && selectedItems.has("ai")
                            : selectedItems.has(item.id);
                        const toggleId = `composer-toolbar-toggle-${item.id}`;
                        return (
                          <div
                            key={item.id}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 py-1">
                            <Label
                              htmlFor={toggleId}
                              className="min-w-0 truncate text-sm font-normal">
                              {item.label}
                              {forced ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {__("(always on)", "pressedmail")}
                                </span>
                              ) : null}
                            </Label>
                            <Switch
                              id={toggleId}
                              data-test={toggleId}
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(value) =>
                                toggleItem(item.id, Boolean(value))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetToDefault}>
              {isMobileTarget
                ? __("Reset Mobile", "pressedmail")
                : __("Reset to default", "pressedmail")}
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              {__("Done", "pressedmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ComposerToolbarCustomizeDialog;
