"use client";

/**
 * Layout Router Component
 *
 * Routes to the appropriate inbox layout based on user preference and tier access.
 * Acts as the entry point for the inbox, delegating to specific layout implementations.
 *
 * @since 1.2.0
 */

import * as React from "react";
import { useLayout } from "@/hooks/useLayout";
import type { MailProps, EmailMessage } from "@/types";
import { getLayoutParts } from "@/layouts";

export interface LayoutRouterProps extends Omit<MailProps, "mails"> {
  /** Optional messages (layouts typically get these from context) */
  mails?: EmailMessage[];
  /** Override the layout (useful for testing or forced layouts) */
  forceLayout?: "pressedm" | "pressedg" | "pressedout";
}

/**
 * Routes to the appropriate layout component based on user selection and tier.
 */
export function LayoutRouter({ forceLayout, ...props }: LayoutRouterProps) {
  const { currentLayout, config } = useLayout();

  // Use forced layout if provided, otherwise use user's selection
  const activeLayout = forceLayout || currentLayout;

  const LayoutComponent = getLayoutParts(activeLayout).inbox.Layout;
  return <LayoutComponent {...props} layoutConfig={config} />;
}

export default LayoutRouter;
