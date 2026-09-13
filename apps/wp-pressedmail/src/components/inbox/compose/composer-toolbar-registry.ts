import { __ } from "@wordpress/i18n";

import type {
  ComposerToolbarItemId,
  ComposerToolbarPreset,
} from "@/hooks/useUserPreferences";
import {
  resolvePlateEmailEditorFeatureFlags,
  type PlateEmailEditorFeatureOverrides,
  type PlateEmailEditorSurface,
} from "@kit/plate/email-surfaces";

export interface ComposerToolbarItemDefinition {
  id: ComposerToolbarItemId;
  label: string;
}

export interface ComposerToolbarGroupDefinition {
  id: string;
  label: string;
  items: ComposerToolbarItemDefinition[];
}

export interface ComposerToolbarResolutionOptions {
  contentBlocksEnabled?: boolean;
  aiEnabled?: boolean;
  inlineImagesEnabled?: boolean;
  surface?: ComposerToolbarSurface;
  surfaceFeatureOverrides?: PlateEmailEditorFeatureOverrides;
}

export type ComposerToolbarSurface = PlateEmailEditorSurface;

/**
 * Render-order groups for the fixed toolbar's LEFT side. The trailing
 * `actions` group lists the RIGHT-side controls (signature, preview, print);
 * those always render and are never filtered by the saved
 * item set, they are listed here so presets/settings know every id.
 */
export const COMPOSER_TOOLBAR_GROUPS: ComposerToolbarGroupDefinition[] = [
  {
    id: "history",
    label: "History",
    items: [
      { id: "history_undo", label: "Undo" },
      { id: "history_redo", label: "Redo" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [{ id: "ai", label: "AI" }],
  },
  {
    id: "import_export",
    label: "Import and export",
    items: [{ id: "import_export", label: "Import / Export" }],
  },
  {
    id: "insert_block",
    label: "Insert and block style",
    items: [
      { id: "block_style", label: "Block style" },
      { id: "font_size", label: "Font size" },
    ],
  },
  {
    id: "font",
    label: "Font",
    items: [{ id: "font_family", label: "Font" }],
  },
  {
    id: "text_formatting",
    label: "Text formatting",
    items: [
      { id: "bold", label: "Bold" },
      { id: "italic", label: "Italic" },
      { id: "underline", label: "Underline" },
      { id: "strikethrough", label: "Strikethrough" },
      { id: "inline_code", label: "Inline code" },
      { id: "text_color", label: "Text color" },
      { id: "highlight_color", label: "Highlight" },
      { id: "body_background", label: "Background color" },
    ],
  },
  {
    id: "lists_alignment",
    label: "Lists and alignment",
    items: [
      { id: "align", label: "Align" },
      { id: "list_menu", label: "Lists" },
    ],
  },
  {
    id: "insert_tools",
    label: "Insert tools",
    items: [
      { id: "insert_link", label: "Insert link" },
      { id: "horizontal_rule", label: "Horizontal rule" },
      { id: "insert_table", label: "Insert table" },
      { id: "emoji", label: "Emoji" },
    ],
  },
  {
    id: "media",
    label: "Media",
    items: [{ id: "insert_image_library", label: "Insert image" }],
  },
  {
    id: "spacing",
    label: "Spacing",
    items: [
      { id: "line_height", label: "Line height" },
      { id: "outdent", label: "Outdent" },
      { id: "indent", label: "Indent" },
    ],
  },
  {
    id: "content_blocks",
    label: "Content blocks",
    items: [{ id: "content_blocks", label: "Insert block" }],
  },
  {
    id: "more",
    label: "More",
    items: [
      { id: "more_menu", label: "More tools" },
      { id: "clear_formatting", label: "Clear formatting" },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    items: [
      { id: "signature", label: "Signature" },
      { id: "preview", label: "Preview" },
      { id: "print", label: "Print" },
    ],
  },
];

/**
 * Single source of truth: the customize-toolbar dialog lists exactly the items
 * the toolbar renders, grouped the same way. Deriving the settings groups from
 * COMPOSER_TOOLBAR_GROUPS keeps the customizer and the real toolbar from
 * drifting apart (the previous hand-maintained copy had already dropped
 * `content_blocks`, so it was unreachable in the dialog).
 */
export const COMPOSER_TOOLBAR_SETTINGS_GROUPS: ComposerToolbarGroupDefinition[] =
  COMPOSER_TOOLBAR_GROUPS;

export const ALL_COMPOSER_TOOLBAR_ITEM_IDS = COMPOSER_TOOLBAR_GROUPS.flatMap(
  (group) => group.items.map((item) => item.id),
);

export const COMPOSER_MOBILE_RECOMMENDED_TOOLBAR_ITEMS: ComposerToolbarItemId[] =
  [
    "history_undo",
    "history_redo",
    "bold",
    "italic",
    "underline",
    "list_menu",
    "insert_link",
    "insert_image_library",
    "ai",
  ];

/**
 * The default email toolbar: one calm row of the tools people reach for in
 * a mail client. Everything else (fonts, sizes, colours, tables, alignment,
 * spacing, import/export) is one click away in Customize, or all at once
 * with the Advanced preset.
 */
export const COMPOSER_STANDARD_TOOLBAR_ITEMS: ComposerToolbarItemId[] = [
  "history_undo",
  "history_redo",
  "ai",
  "block_style",
  "bold",
  "italic",
  "underline",
  "list_menu",
  "insert_link",
  "insert_image_library",
  "more_menu",
  "clear_formatting",
  // Right-side actions: always rendered, listed so the Customize switches
  // show them as on.
  "signature",
  "preview",
  "print",
];

export const COMPOSER_TOOLBAR_PRESETS: Record<
  Exclude<ComposerToolbarPreset, "custom">,
  ComposerToolbarItemId[]
> = {
  simple: [
    "bold",
    "italic",
    "list_menu",
    "insert_link",
    "print",
  ],
  standard: COMPOSER_STANDARD_TOOLBAR_ITEMS,
  advanced: ALL_COMPOSER_TOOLBAR_ITEM_IDS,
  recommended_mobile: COMPOSER_MOBILE_RECOMMENDED_TOOLBAR_ITEMS,
};

export const DEFAULT_COMPOSER_TOOLBAR_ITEMS = COMPOSER_TOOLBAR_PRESETS.standard;
export const DEFAULT_COMPOSER_MOBILE_TOOLBAR_ITEMS =
  COMPOSER_TOOLBAR_PRESETS.recommended_mobile;

export const COMPOSER_AI_TOOLBAR_ENABLED = __IS_PRO__ && __ENABLE_AI_SETTINGS__;

const ENABLED_COMPOSER_TOOLBAR_ITEM_IDS = new Set<ComposerToolbarItemId>(
  ALL_COMPOSER_TOOLBAR_ITEM_IDS,
);

/**
 * Saved-preference ids that were consolidated into newer controls. Mapping
 * (instead of dropping) keeps previously visible functionality visible for
 * users with stale `custom` item sets:
 * - the four alignment buttons became the single Align dropdown
 * - quote / code block / horizontal rule moved into the Insert dropdown
 */
const LEGACY_COMPOSER_TOOLBAR_ITEM_ALIASES: Record<
  string,
  ComposerToolbarItemId
> = {
  align_left: "align",
  align_center: "align",
  align_right: "align",
  align_justify: "align",
  // quote / code block are reachable from the Block style (turn-into) dropdown;
  // the standalone Insert popover was removed and Horizontal rule is now its own
  // top-level toolbar item, so a legacy "insert_menu" maps to it.
  quote: "block_style",
  code_block: "block_style",
  insert_menu: "horizontal_rule",
  export: "import_export",
  import: "import_export",
  bulleted_list: "list_menu",
  numbered_list: "list_menu",
  task_list: "list_menu",
  toggle_block: "list_menu",
};

const AUTHORING_SURFACE_TOOLBAR_ITEM_IDS = new Set<ComposerToolbarItemId>([
  "history_undo",
  "history_redo",
  "ai",
  "import_export",
  "block_style",
  "font_family",
  "font_size",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "inline_code",
  "text_color",
  "highlight_color",
  "align",
  "list_menu",
  "line_height",
  "indent",
  "outdent",
  "insert_link",
  "horizontal_rule",
  "insert_table",
  "emoji",
  "insert_image_library",
  "content_blocks",
  "clear_formatting",
  "more_menu",
  // Preview is editor-safe on every surface (email, signature, auto-reply) and
  // is always shown + non-removable; the toolbar forces it on regardless of the
  // saved item set.
  "preview",
]);

function isToolbarItemAvailable(
  itemId: ComposerToolbarItemId,
  options: ComposerToolbarResolutionOptions,
): boolean {
  const aiEnabled = options.aiEnabled ?? COMPOSER_AI_TOOLBAR_ENABLED;
  const surface = options.surface ?? "email";
  const surfaceFeatures = resolvePlateEmailEditorFeatureFlags(
    surface,
    options.surfaceFeatureOverrides,
  );

  if (
    surface !== "email" &&
    !AUTHORING_SURFACE_TOOLBAR_ITEM_IDS.has(itemId)
  ) {
    return false;
  }

  if (itemId === "content_blocks") {
    return surfaceFeatures.contentBlocks && Boolean(options.contentBlocksEnabled);
  }

  if (
    itemId === "insert_image_library"
  ) {
    return surfaceFeatures.inlineMedia && options.inlineImagesEnabled !== false;
  }

  if (itemId === "ai") {
    return surfaceFeatures.aiCommands && aiEnabled;
  }

  if (itemId === "signature") {
    return surfaceFeatures.signatures;
  }

  if (itemId === "preview") {
    return surfaceFeatures.preview;
  }

  return true;
}

function filterAvailableToolbarItems(
  itemIds: Iterable<ComposerToolbarItemId>,
  options: ComposerToolbarResolutionOptions = {},
): ComposerToolbarItemId[] {
  return Array.from(itemIds).filter((itemId) =>
    isToolbarItemAvailable(itemId, options),
  );
}

function filterEnabledToolbarItems(
  itemIds: readonly unknown[] | undefined,
): ComposerToolbarItemId[] {
  if (!itemIds?.length) {
    return [];
  }

  const enabled: ComposerToolbarItemId[] = [];

  for (const itemId of itemIds) {
    if (typeof itemId !== "string") {
      continue;
    }

    const mappedId =
      LEGACY_COMPOSER_TOOLBAR_ITEM_ALIASES[itemId] ??
      (itemId as ComposerToolbarItemId);

    if (
      ENABLED_COMPOSER_TOOLBAR_ITEM_IDS.has(mappedId) &&
      !enabled.includes(mappedId)
    ) {
      enabled.push(mappedId);
    }
  }

  return enabled;
}

export function resolveComposerToolbarItems(
  preset: ComposerToolbarPreset | undefined,
  customItems: readonly unknown[] | undefined,
  options: ComposerToolbarResolutionOptions = {},
): Set<ComposerToolbarItemId> {
  if (preset === "custom") {
    const enabledCustomItems = filterEnabledToolbarItems(customItems);
    return new Set(
      filterAvailableToolbarItems(
        enabledCustomItems.length
          ? enabledCustomItems
          : DEFAULT_COMPOSER_TOOLBAR_ITEMS,
        options,
      ),
    );
  }

  const resolvedPreset = preset ?? "standard";
  // Signature and auto-reply editors are formatting tools with their own,
  // already narrowed item set; the calm Standard row is for writing mail.
  const presetItems =
    resolvedPreset === "standard" && (options.surface ?? "email") !== "email"
      ? COMPOSER_TOOLBAR_PRESETS.advanced
      : (COMPOSER_TOOLBAR_PRESETS[resolvedPreset] ??
        COMPOSER_TOOLBAR_PRESETS.standard);

  return new Set(filterAvailableToolbarItems(presetItems, options));
}

/**
 * Translated labels for the Customize dialog, keyed by group or item id. The
 * English labels above are ids for tests and fallbacks; they are never shown
 * untranslated. Built on call: a module-level __() runs before main.tsx loads
 * the locale catalog, so it would always return English.
 */
function toolbarLabels(): Record<string, string> {
  return {
    history: __("History", "pressedmail"),
    history_undo: __("Undo", "pressedmail"),
    history_redo: __("Redo", "pressedmail"),
    ai: __("AI", "pressedmail"),
    import_export: __("Import and export", "pressedmail"),
    insert_block: __("Insert and block style", "pressedmail"),
    block_style: __("Block style", "pressedmail"),
    font_size: __("Font size", "pressedmail"),
    font: __("Font", "pressedmail"),
    font_family: __("Font", "pressedmail"),
    text_formatting: __("Text formatting", "pressedmail"),
    bold: __("Bold", "pressedmail"),
    italic: __("Italic", "pressedmail"),
    underline: __("Underline", "pressedmail"),
    strikethrough: __("Strikethrough", "pressedmail"),
    inline_code: __("Inline code", "pressedmail"),
    text_color: __("Text color", "pressedmail"),
    highlight_color: __("Highlight", "pressedmail"),
    body_background: __("Background color", "pressedmail"),
    lists_alignment: __("Lists and alignment", "pressedmail"),
    align: __("Align", "pressedmail"),
    list_menu: __("Lists", "pressedmail"),
    insert_tools: __("Insert tools", "pressedmail"),
    insert_link: __("Insert link", "pressedmail"),
    horizontal_rule: __("Horizontal rule", "pressedmail"),
    insert_table: __("Insert table", "pressedmail"),
    emoji: __("Emoji", "pressedmail"),
    media: __("Media", "pressedmail"),
    insert_image_library: __("Insert image", "pressedmail"),
    spacing: __("Spacing", "pressedmail"),
    line_height: __("Line height", "pressedmail"),
    outdent: __("Outdent", "pressedmail"),
    indent: __("Indent", "pressedmail"),
    content_blocks: __("Content blocks", "pressedmail"),
    more: __("More", "pressedmail"),
    more_menu: __("More tools", "pressedmail"),
    clear_formatting: __("Clear formatting", "pressedmail"),
    actions: __("Actions", "pressedmail"),
    signature: __("Signature", "pressedmail"),
    preview: __("Preview", "pressedmail"),
    print: __("Print", "pressedmail"),
  };
}

export function getComposerToolbarSettingsGroups(
  options: ComposerToolbarResolutionOptions = {},
): ComposerToolbarGroupDefinition[] {
  const labels = toolbarLabels();
  return COMPOSER_TOOLBAR_SETTINGS_GROUPS.map((group) => ({
    ...group,
    label: labels[group.id] ?? group.label,
    items: group.items
      .filter((item) => isToolbarItemAvailable(item.id, options))
      .map((item) => ({ ...item, label: labels[item.id] ?? item.label })),
  })).filter((group) => group.items.length > 0);
}
