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
  standard: ALL_COMPOSER_TOOLBAR_ITEM_IDS,
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

  return new Set(
    filterAvailableToolbarItems(
      COMPOSER_TOOLBAR_PRESETS[preset ?? "standard"] ??
        COMPOSER_TOOLBAR_PRESETS.standard,
      options,
    ),
  );
}

export function getComposerToolbarSettingsGroups(
  options: ComposerToolbarResolutionOptions = {},
): ComposerToolbarGroupDefinition[] {
  return COMPOSER_TOOLBAR_SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      isToolbarItemAvailable(item.id, options),
    ),
  })).filter((group) => group.items.length > 0);
}
