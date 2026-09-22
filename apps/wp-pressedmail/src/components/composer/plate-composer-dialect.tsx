"use client";

/**
 * The composer's editing dialects.
 *
 * Markdown and Rich text are two presentations of ONE document. A dialect
 * picks which plugins the Plate editor is built from; it never touches the
 * value. That is what makes switching free and lossless in both directions,
 * and why nothing here migrates anything.
 *
 * Rich text drops the block chrome (the drag handles, the "/" menu, the
 * empty-block hint) and renders block-only nodes through the read-only
 * renderers the email serializer already uses, so a column, a toggle or a
 * table reads the way the recipient will see it. Those nodes stay in the tree
 * untouched: switch back to Markdown and every affordance returns. Block
 * selection stays behind either way, on purpose; see COMPOSER_CHROME_KITS.
 *
 * The dialect axis itself lives in `@kit/plate/email-surfaces`, beside the
 * surface presets.
 */

import * as React from "react";
import { KEYS } from "@kit/plate";
import type { Value } from "@kit/plate";
import {
  getPlateEmailEditorDialectPreset,
  type PlateEmailEditorChromeFeature,
  type PlateEmailEditorDialect,
} from "@kit/plate/email-surfaces";
import { __ } from "@wordpress/i18n";

import { ComposerReactPlugins } from "./plate-composer-react-kit";
import { BlockPlaceholderKit } from "./plate/block-placeholder-kit";
import { CalloutElementStatic } from "./plate/callout-node-static";
import {
  CodeBlockElementReadOnly,
  CodeLineElement,
  CodeSyntaxLeaf,
} from "./plate/code-block-node";
import {
  ColumnElementStatic,
  ColumnGroupElementStatic,
} from "./plate/column-node-static";
import { DndKit } from "./plate/dnd-kit";
import {
  EquationElementStatic,
  InlineEquationElementStatic,
} from "./plate/equation-node-static";
import { ExcalidrawElementStatic } from "./plate/excalidraw-node-static";
import {
  AudioElementStatic,
  FileElementStatic,
  MediaEmbedElementStatic,
  VideoElementStatic,
} from "./plate/media-node-static";
import { SlashKit } from "./plate/slash-kit";
import {
  TableCellElementStatic,
  TableCellHeaderElementStatic,
  TableElementStatic,
  TableRowElementStatic,
} from "./plate/table-node-static";
import { TocElementStatic } from "./plate/toc-node-static";
import { ToggleElementStatic } from "./plate/toggle-node-static";

/**
 * A renderer written for `PlateStatic`. The editor invokes these; nothing here
 * renders one directly, so they are only ever handed to `configure`.
 */
type ReadOnlyNodeRenderer = React.ComponentType<never>;

/**
 * Host a `*-static.tsx` renderer inside the live editor.
 *
 * Those renderers are built for `PlateStatic`, where a node's attributes carry
 * no ref. Inside a live editor that ref is what maps a DOM node back to its
 * Slate path, and the static renderer overwrites it, so it is handed back
 * through the ref slot rather than dropped.
 */
function hostedReadOnlyRenderer<P extends object>(
  Static: React.ComponentType<P>,
): ReadOnlyNodeRenderer {
  const passthrough = Static as unknown as React.ComponentType<
    Record<string, unknown> & { ref?: React.Ref<HTMLElement> }
  >;
  const Hosted = React.forwardRef<HTMLElement, P>((props, ref) => {
    const live = (props as { attributes?: { ref?: unknown } }).attributes?.ref;
    return React.createElement(passthrough, {
      ...(props as unknown as Record<string, unknown>),
      ref: (ref ?? live) as React.Ref<HTMLElement> | undefined,
    });
  });
  Hosted.displayName = `HostedReadOnly(${Static.displayName ?? Static.name})`;
  return Hosted;
}

/**
 * Block-only nodes: everything that only makes sense with the block chrome
 * around it. Keyed by node type, mapped to its read-only renderer.
 *
 * Images stay interactive on purpose. A picture in a message is ordinary
 * word-processor formatting, not block chrome.
 */
const READ_ONLY_BLOCK_NODES: Record<string, ReadOnlyNodeRenderer> = {
  [KEYS.audio]: hostedReadOnlyRenderer(AudioElementStatic),
  [KEYS.callout]: hostedReadOnlyRenderer(CalloutElementStatic),
  // Code is the one block that keeps a live themed renderer rather than the
  // serializer's: code-block-node-static.tsx carries inline light literals
  // for email clients, which would paint a white block on a dark canvas.
  // The themed half also keeps the hljs token classes, so Rich text shows
  // syntax colours.
  [KEYS.codeBlock]: CodeBlockElementReadOnly,
  [KEYS.codeLine]: CodeLineElement,
  [KEYS.codeSyntax]: CodeSyntaxLeaf,
  [KEYS.column]: hostedReadOnlyRenderer(ColumnElementStatic),
  [KEYS.columnGroup]: hostedReadOnlyRenderer(ColumnGroupElementStatic),
  [KEYS.equation]: hostedReadOnlyRenderer(EquationElementStatic),
  [KEYS.excalidraw]: hostedReadOnlyRenderer(ExcalidrawElementStatic),
  [KEYS.file]: hostedReadOnlyRenderer(FileElementStatic),
  [KEYS.inlineEquation]: hostedReadOnlyRenderer(InlineEquationElementStatic),
  [KEYS.mediaEmbed]: hostedReadOnlyRenderer(MediaEmbedElementStatic),
  [KEYS.table]: hostedReadOnlyRenderer(TableElementStatic),
  [KEYS.td]: hostedReadOnlyRenderer(TableCellElementStatic),
  [KEYS.th]: hostedReadOnlyRenderer(TableCellHeaderElementStatic),
  [KEYS.toc]: hostedReadOnlyRenderer(TocElementStatic),
  [KEYS.toggle]: hostedReadOnlyRenderer(ToggleElementStatic),
  [KEYS.tr]: hostedReadOnlyRenderer(TableRowElementStatic),
  [KEYS.video]: hostedReadOnlyRenderer(VideoElementStatic),
};

/** What each block-only node is called in the notice shown before the switch.
 * Built per call so the strings resolve after the locale catalog has loaded,
 * not when this module is first imported.
 */
function readOnlyBlockNodeLabels(): Record<string, string> {
  return {
    [KEYS.audio]: __("Audio", "pressedmail"),
    [KEYS.callout]: __("Callouts", "pressedmail"),
    [KEYS.codeBlock]: __("Code blocks", "pressedmail"),
    [KEYS.column]: __("Columns", "pressedmail"),
    [KEYS.columnGroup]: __("Columns", "pressedmail"),
    [KEYS.equation]: __("Equations", "pressedmail"),
    [KEYS.excalidraw]: __("Drawings", "pressedmail"),
    [KEYS.file]: __("File attachments", "pressedmail"),
    [KEYS.inlineEquation]: __("Equations", "pressedmail"),
    [KEYS.mediaEmbed]: __("Media embeds", "pressedmail"),
    [KEYS.table]: __("Tables", "pressedmail"),
    [KEYS.td]: __("Tables", "pressedmail"),
    [KEYS.th]: __("Tables", "pressedmail"),
    [KEYS.toc]: __("Tables of contents", "pressedmail"),
    [KEYS.toggle]: __("Toggles", "pressedmail"),
    [KEYS.tr]: __("Tables", "pressedmail"),
    [KEYS.video]: __("Videos", "pressedmail"),
  };
}

/**
 * The chrome kits, one per dialect flag. Adding a chrome kit means adding its
 * flag here, which is what makes the dialect answer for it.
 *
 * `BlockMenuKit` is deliberately absent. It is BlockSelectionPlugin, not a
 * menu: the only per-block menu in the composer is the drag handle's, and that
 * leaves with DndKit. Block selection also has to survive in every dialect,
 * because the AI menu calls `blockSelection.set()` unconditionally and taking
 * the plugin away made that throw on the first click into an open AI panel.
 * Keeping it costs nothing on screen: BlockSelection renders null until a
 * block is selected, and Rich text removes the handles that could select one.
 */
export const COMPOSER_CHROME_KITS: ReadonlyArray<{
  readonly chrome: PlateEmailEditorChromeFeature;
  readonly plugins: readonly unknown[];
}> = [
  { chrome: "blockDragHandles", plugins: DndKit },
  { chrome: "slashCommands", plugins: SlashKit },
  { chrome: "blockPlaceholder", plugins: BlockPlaceholderKit },
];

/** Node types Rich text renders read-only, in a stable order. */
export function getReadOnlyBlockNodeTypes(): string[] {
  return Object.keys(READ_ONLY_BLOCK_NODES);
}

/**
 * What each dialect is called in the Format control and in the switch notice.
 * Resolved per call so the strings land after the locale catalog has loaded.
 */
export function composerDialectLabel(dialect: PlateEmailEditorDialect): string {
  switch (dialect) {
    case "rich_text":
      return __("Rich text", "pressedmail");
    case "plain":
      return __("Plain text", "pressedmail");
    default:
      return __("Markdown", "pressedmail");
  }
}

/**
 * Which block-only node kinds a document contains, as display labels. Empty
 * for a document that Rich text can present unchanged, which is what lets the
 * composer skip the warning.
 */
export function findReadOnlyBlockNodeLabels(value: Value | null): string[] {
  const labels = readOnlyBlockNodeLabels();
  const found = new Set<string>();

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as { type?: unknown; children?: unknown };
    const label =
      typeof record.type === "string" ? labels[record.type] : undefined;
    if (label) found.add(label);
    visit(record.children);
  };

  visit(value);

  return [...found];
}

type ComposerReactPlugin = (typeof ComposerReactPlugins)[number];

/**
 * The composer's Plate plugin list for one dialect. Markdown is the kit as
 * written; every other dialect is derived from it, so the two can never drift
 * into separate kits.
 */
export function buildComposerReactPlugins(
  dialect: PlateEmailEditorDialect,
): ComposerReactPlugin[] {
  const preset = getPlateEmailEditorDialectPreset(dialect);
  const dropped = new Set<unknown>(
    COMPOSER_CHROME_KITS.filter((kit) => !preset.chrome[kit.chrome]).flatMap(
      (kit) => [...kit.plugins],
    ),
  );

  return ComposerReactPlugins.filter((plugin) => !dropped.has(plugin)).map(
    (plugin) => {
      const nodeType = (plugin as { node?: { type?: string } }).node?.type;
      const component = nodeType
        ? preset.readOnlyBlockNodes
          ? READ_ONLY_BLOCK_NODES[nodeType]
          : undefined
        : undefined;

      if (!component) return plugin;

      return (
        plugin as unknown as {
          configure: (config: unknown) => ComposerReactPlugin;
        }
      ).configure({ node: { component } });
    },
  );
}
