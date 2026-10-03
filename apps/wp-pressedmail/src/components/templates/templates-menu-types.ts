/**
 * The row shape the Templates menu shares between its three surfaces: the
 * header popover, the phone More screen and the speed dial. Types only, so both
 * editions can import it: the Pro model fills it in and the Free model never
 * does.
 */

import type { ElementType } from "react";

export type TemplatesMenuRowId =
  | "new-email"
  | "new-template"
  | "manage"
  | "forms"
  | "campaigns"
  | "campaign-setup";

/** What a row does when it is chosen. */
export type TemplatesMenuAction =
  | { type: "picker" }
  | { type: "navigate"; to: string };

export interface TemplatesMenuRow {
  id: TemplatesMenuRowId;
  label: string;
  /** One line for surfaces that describe their rows (the More screen). */
  description: string;
  icon: ElementType<{ className?: string }>;
  action: TemplatesMenuAction;
  /** The `data-test` id the popover row carries. */
  dataTest: string;
}

/** A speed dial entry: one destination, no lock. */
export interface TemplatesSpeedDialItem {
  id: "templates" | "campaigns";
  label: string;
  icon: ElementType<{ className?: string }>;
  path: string;
}

/**
 * Where Campaigns stands for this user.
 *
 *  - available: the feature is on and licensed, so the row navigates.
 *  - hidden: the feature is unavailable, the licence is not Ultimate, or this
 *    user cannot manage Campaigns.
 */
export type CampaignsRowState = "available" | "hidden";
