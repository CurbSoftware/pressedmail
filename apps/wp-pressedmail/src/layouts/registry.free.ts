/**
 * Free Layout Registry
 *
 * Registers only the default layout implementation. Pro layout IDs fall
 * back to default parts if stale storage asks for them, but their component
 * modules are not imported into the Free build.
 *
 * @since 3.2.0
 */

import type { LayoutId } from "@/types/features";
import { getLayoutPreviews as getManifestLayoutPreviews } from "@/manifest";
import type {
  LayoutRegistryEntry,
  InboxLayoutParts,
  ContactsLayoutParts,
  CalendarLayoutParts,
} from "./types";

import { defaultFreeLayoutParts } from "./variants/default.free";

const LAYOUT_REGISTRY: Partial<Record<LayoutId, LayoutRegistryEntry>> = {
  pressedm: defaultFreeLayoutParts,
};

export const layoutRegistry = LAYOUT_REGISTRY as Record<
  LayoutId,
  LayoutRegistryEntry
>;

export function getLayoutParts(layoutId: LayoutId): LayoutRegistryEntry {
  return LAYOUT_REGISTRY[layoutId] ?? defaultFreeLayoutParts;
}

export function getInboxParts(layoutId: LayoutId): InboxLayoutParts {
  return getLayoutParts(layoutId).inbox;
}

// This build ships neither; the functions exist so the export surface matches.
export function getContactsParts(_layoutId: LayoutId): ContactsLayoutParts {
  return undefined as never;
}

export function getCalendarParts(_layoutId: LayoutId): CalendarLayoutParts {
  return undefined as never;
}

export function isValidLayout(layoutId: string): layoutId is LayoutId {
  return layoutId === "pressedm";
}

export function getAvailableLayoutIds(): LayoutId[] {
  return ["pressedm"];
}

export function getInboxComponent<K extends keyof InboxLayoutParts>(
  layoutId: LayoutId,
  componentKey: K,
): InboxLayoutParts[K] {
  return getInboxParts(layoutId)[componentKey];
}

export function getContactsComponent<K extends keyof ContactsLayoutParts>(
  layoutId: LayoutId,
  componentKey: K,
): ContactsLayoutParts[K] {
  return getContactsParts(layoutId)[componentKey];
}

export function getCalendarComponent<K extends keyof CalendarLayoutParts>(
  layoutId: LayoutId,
  componentKey: K,
): CalendarLayoutParts[K] {
  return getCalendarParts(layoutId)[componentKey];
}

export function getLayoutPreviews() {
  return getManifestLayoutPreviews();
}
