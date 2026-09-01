export const SIDEBAR_NAV_ITEM_CLASS =
  "flex min-w-0 items-center gap-1.5 px-2 py-2 text-xs font-medium";

export const SIDEBAR_NAV_ICON_CLASS = "h-3.5 w-3.5 shrink-0";

export const SIDEBAR_NAV_MARKER_CLASS = "h-3.5 w-3.5 shrink-0";

/**
 * Trailing row actions (the folder 3-dot menu) must not set the row's height.
 *
 * A 24px action button beats the 16px text line-box, so user folder rows
 * rendered 40px against the 32px of the system folders directly above them,
 * and against the 32px of user rows that happen to have no actions. The
 * negative block margin shrinks the button's margin box back to the line-box
 * height: the row measures 32px everywhere, while the button keeps its full
 * 24px hit target.
 *
 * Deliberately NOT `absolute`. That was tried before and pushed the unread
 * count underneath the actions; `ProviderFolderTree.test.tsx` pins it against
 * coming back.
 */
export const SIDEBAR_NAV_ROW_ACTION_CLASS =
  "-my-1 flex h-6 w-6 items-center justify-center rounded-sm";
