"use client";

/**
 * Default Header Component
 *
 * Uses the SharedHeader with search in center slot.
 * Navigation is handled separately by GlobalNavBar in the LayoutNavigationShell.
 *
 * @since 2.0.0
 * @updated 3.1.0 - Now renders SharedHeader instead of null
 */

import { SharedHeader } from "@/layouts/shared/components/SharedHeader";

export interface DefaultHeaderProps {
  className?: string;
}

export function DefaultHeader({ className }: DefaultHeaderProps) {
  return <SharedHeader className={className} />;
}

export default DefaultHeader;
