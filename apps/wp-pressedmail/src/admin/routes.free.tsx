import type { ComponentType } from "react";
import {
  createHashRouter,
  Navigate,
  Outlet,
  type RouteObject,
} from "react-router-dom";

import ApplicationLayout from "@/components/application-layout/ApplicationLayout";
import { MobileOnlyRoute } from "@/components/mobile-shell/MobileOnlyRoute";
import ErrorPage from "@/admin/pages/error/Error";
import Inbox from "@/admin/pages/inbox";
import FreeSettings from "@/admin/pages/settings/free-settings";

function mobileOnlyLazy(
  loader: () => Promise<{ default: ComponentType }>,
  redirectTo: string,
): NonNullable<RouteObject["lazy"]> {
  return () =>
    loader().then((module) => {
      const Screen = module.default;
      return {
        Component: function GuardedMobileScreen() {
          return (
            <MobileOnlyRoute redirectTo={redirectTo}>
              <Screen />
            </MobileOnlyRoute>
          );
        },
      };
    });
}

export const router = createHashRouter(
  [
    {
      path: "/",
      element: <Outlet />,
      errorElement: <ErrorPage />,
      children: [
        {
          element: <ApplicationLayout />,
          children: [
            { path: "/", element: <Inbox /> },
            { path: "inbox", element: <Inbox /> },
            {
              path: "inbox/m/:id",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileMailReaderScreen"),
                "/inbox",
              ),
            },
            {
              path: "compose",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileComposeScreen"),
                "/inbox",
              ),
            },
            {
              path: "search",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileSearchScreen"),
                "/inbox",
              ),
            },
            {
              path: "folders",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileFoldersScreen"),
                "/inbox",
              ),
            },
            {
              path: "accounts",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileAccountsScreen"),
                "/settings",
              ),
            },
            {
              path: "install",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileInstallScreen"),
                "/inbox",
              ),
            },
            {
              path: "help",
              lazy: mobileOnlyLazy(
                () => import("./pages/mobile/MobileHelpScreen"),
                "/inbox",
              ),
            },
            { path: "settings", element: <FreeSettings /> },
            { path: "settings/admin", element: <FreeSettings /> },
            {
              path: "settings/:section",
              lazy: mobileOnlyLazy(
                () => import("./pages/settings/free-mobile-settings-detail"),
                "/settings",
              ),
            },
            { path: "login", element: <Navigate to="/inbox" replace /> },
            { path: "*", element: <Navigate to="/inbox" replace /> },
          ],
        },
        { path: "*", element: <Navigate to="/inbox" replace /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
