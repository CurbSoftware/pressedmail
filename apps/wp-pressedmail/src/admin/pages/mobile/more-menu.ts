import { __ } from "@wordpress/i18n";
import {
  Activity,
  CircleHelp,
  Folder,
  Key,
  LayoutGrid,
  PenTool,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Tags,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";

export interface MoreMenuRow {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Route to navigate to. Mutually exclusive with `action`. */
  to?: string;
  /** Named imperative action the host resolves (e.g. toggling a panel). */
  action?: "activity";
  /** Optional trailing count badge (e.g. active background tasks). */
  badge?: number;
}

export interface MoreMenuSection {
  id: string;
  label: string;
  rows: MoreMenuRow[];
}

export interface MoreMenuOptions {
  canManageSettings: boolean;
  canManagePro: boolean;
  activeTaskCount?: number;
}

/** Route and capability metadata for the single More screen. */
export function buildMoreMenuSections({
  canManageSettings,
  canManagePro,
  activeTaskCount = 0,
}: MoreMenuOptions): MoreMenuSection[] {
  const mailRows: MoreMenuRow[] = [
    {
      id: "activity",
      label: __("Activity", "pressedmail"),
      description: __("Background sync and task progress.", "pressedmail"),
      icon: Activity,
      action: "activity",
      badge: activeTaskCount,
    },
    {
      id: "accounts",
      label: __("Switch account", "pressedmail"),
      description: __("Choose which mailbox to read.", "pressedmail"),
      icon: UserCircle2,
      to: "/accounts",
    },
    {
      id: "folders",
      label: __("Folders", "pressedmail"),
      description: __("Browse folders and mailbox views.", "pressedmail"),
      icon: Folder,
      to: "/folders",
    },
    {
      id: "labels",
      label: __("Labels / Tags", "pressedmail"),
      // Tags are managed in the Folders screen's own tag section; there has
      // never been a standalone tags settings tab to send anyone to.
      description: __("Filter and manage your tags.", "pressedmail"),
      icon: Tags,
      to: "/folders",
    },
  ];

  const settingsRows: MoreMenuRow[] = [
    {
      id: "settings",
      label: __("Settings", "pressedmail"),
      description: __("Everything you can configure.", "pressedmail"),
      icon: Settings2,
      to: "/settings",
    },
    {
      id: "preferences",
      label: __("Preferences", "pressedmail"),
      description: __("Reading, sending, and list behaviour.", "pressedmail"),
      icon: SlidersHorizontal,
      to: "/settings/preferences",
    },
    {
      id: "signatures",
      label: __("Signatures", "pressedmail"),
      description: __("Sign-offs added to your messages.", "pressedmail"),
      icon: PenTool,
      to: "/settings/signatures",
    },
  ];

  // Both rows are Pro surfaces, so the build variant guards them alongside the
  // capability. A runtime-only condition is not enough: Rollup cannot eliminate
  // a branch it cannot evaluate, so `/settings/admin-license` was emitted into
  // the Free script and the edition-purity gate rejected the Free bundle for
  // carrying a Pro marker. With the variant check the branch is dead code in
  // Free and those ids never reach the bundle.
  if (canManagePro && __IS_PRO__) {
    settingsRows.push({
      id: "ai-tools",
      label: __("AI Tools", "pressedmail"),
      description: __("Summaries, drafting, and tagging.", "pressedmail"),
      icon: Sparkles,
      to: "/settings/admin-ai-tools",
    });
    settingsRows.push({
      id: "licensing",
      label: __("Licensing", "pressedmail"),
      description: __("Licence key and plan.", "pressedmail"),
      icon: Key,
      to: "/settings/admin-license",
    });
  }

  const supportRows: MoreMenuRow[] = [
    {
      id: "install",
      label: __("Add to Home Screen", "pressedmail"),
      description: __("Keep PressedMail one tap away.", "pressedmail"),
      icon: LayoutGrid,
      to: "/install",
    },
    {
      id: "help",
      label: __("Help & Docs", "pressedmail"),
      description: __("Guides, fixes, and support.", "pressedmail"),
      icon: CircleHelp,
      to: "/help",
    },
  ];

  // The diagnostics settings section only exists for users who can manage
  // settings, so without that capability the row lands on an empty route.
  if (canManageSettings) {
    supportRows.push({
      id: "diagnostics",
      label: __("Diagnostics", "pressedmail"),
      description: __("Server environment and plugin status.", "pressedmail"),
      icon: Stethoscope,
      to: "/settings/admin-diagnostics",
    });
  }

  return [
    { id: "app", label: __("Mail", "pressedmail"), rows: mailRows },
    {
      id: "settings",
      label: __("Settings", "pressedmail"),
      rows: settingsRows,
    },
    { id: "support", label: __("Support", "pressedmail"), rows: supportRows },
  ];
}
