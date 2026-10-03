/**
 * Free edition: templates, forms and campaigns are Pro, so the Templates menu
 * has no rows on any surface. The header button, the More section and the
 * speed dial entries all key off these being empty.
 */

import type { MoreMenuSection } from "@/admin/pages/mobile/more-menu";

import type {
  CampaignsRowState,
  TemplatesMenuRow,
  TemplatesSpeedDialItem,
} from "./templates-menu-types";

export type {
  CampaignsRowState,
  TemplatesMenuAction,
  TemplatesMenuRow,
  TemplatesMenuRowId,
  TemplatesSpeedDialItem,
} from "./templates-menu-types";

// Stable references: callers put these in dependency arrays.
const NO_ROWS: TemplatesMenuRow[] = [];
const NO_ITEMS: TemplatesSpeedDialItem[] = [];
const NO_SECTIONS: MoreMenuSection[] = [];
const NOTHING_TO_RUN = (): void => {};

export function buildTemplatesMenuRows(
  _campaigns?: CampaignsRowState,
): TemplatesMenuRow[] {
  return NO_ROWS;
}

export function buildTemplatesSpeedDialItems(
  _campaigns?: CampaignsRowState,
): TemplatesSpeedDialItem[] {
  return NO_ITEMS;
}

export function useTemplatesMenuRows(): TemplatesMenuRow[] {
  return NO_ROWS;
}

export function useTemplatesSpeedDialItems(): TemplatesSpeedDialItem[] {
  return NO_ITEMS;
}

/** The More screen's Templates section. Free has none, so the shared screen lists nothing extra. */
export function useTemplatesMoreSections(): MoreMenuSection[] {
  return NO_SECTIONS;
}

/** Runs a chosen row. Free has no rows, so there is nothing to run. */
export function useRunTemplatesMenuRow(): (row: TemplatesMenuRow, opener?: HTMLElement | null) => void {
  return NOTHING_TO_RUN;
}
