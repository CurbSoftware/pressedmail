"use client";

import * as React from "react";
import { Link } from "lucide-react";
import {
  useLinkToolbarButton,
  useLinkToolbarButtonState,
} from "@kit/plate/link/react";

import { __ } from "@wordpress/i18n";

import {
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from "@/components/composer/toolbar";

/**
 * Opens the floating link editor (LinkFloatingToolbar, rendered by the
 * LinkPlugin's afterEditable) instead of a modal dialog, matching the other
 * composer bubble menus and the mod+k shortcut. URL safety is enforced by the
 * plugin's allowedSchemes/transformInput config in plate-composer-react-kit.
 */
export function LinkToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const state = useLinkToolbarButtonState();
  const { props: buttonProps } = useLinkToolbarButton(state);

  return (
    <ToolbarButton
      {...props}
      {...buttonProps}
      data-plate-focus
      tooltip={__("Link", "pressedmail")}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          buttonProps.onClick();
        }
      }}>
      <Link className={COMPOSER_TOOLBAR_ICON_CLASS} />
    </ToolbarButton>
  );
}
