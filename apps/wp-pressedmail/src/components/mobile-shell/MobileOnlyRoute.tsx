"use client";

import * as React from "react";
import { Navigate } from "react-router-dom";

import { useIsMobileOrTablet } from "@/hooks/useMobile";

import { useMobileShellFlag } from "./useMobileShellFlag";

export interface MobileOnlyRouteProps {
  /** Desktop destination to redirect to when the compact shell is not active. */
  redirectTo: string;
  children: React.ReactNode;
}

/**
 * Route guard for screens that only make sense inside the phone/tablet compact
 * shell (the Mobile* navigation + detail screens). These routes are registered
 * unconditionally, but both ApplicationLayout branches render the same
 * `<Outlet/>`, so without a guard a mobile screen leaks into the desktop chrome
 * (and previously threw `useBackStack must be used inside a BackStackProvider`
 * because the phone-shell providers were absent). When the compact shell is not
 * active, desktop-width container or the rollout flag off, redirect to the
 * desktop equivalent instead of rendering the mobile layout.
 *
 * The condition mirrors ApplicationLayout's `compactShellEnabled`
 * (`useIsMobileOrTablet() && useMobileShellFlag()`) so the two never disagree.
 */
export function MobileOnlyRoute({ redirectTo, children }: MobileOnlyRouteProps) {
  const isMobileOrTablet = useIsMobileOrTablet();
  const mobileShellEnabled = useMobileShellFlag();
  const compactShellEnabled = isMobileOrTablet && mobileShellEnabled;
  if (!compactShellEnabled) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}

export default MobileOnlyRoute;
