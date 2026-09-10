import { createContext, useContext, useEffect, useRef } from "react";
import * as ReactRouter from "react-router-dom";

import { useComposer } from "@/context/composer/ComposerContext";
import { consumeComposeRouteSearch } from "@/lib/mailto";

const fallbackDataRouterContext = createContext<unknown>(null);

/**
 * Global navigation guard for dirty compose drafts. Mounted once inside the
 * router tree (ApplicationLayout) in both editions; the mounted compose form
 * registers its dirtiness + discard dialog through ComposerContext, and this
 * component funnels every kind of navigation into that SAME dialog
 * (ComposeDiscardDialog: Save Draft / Delete Draft / Keep Editing):
 *
 *  (a) in-app route changes (inbox, calendar, contacts, settings, mobile
 *      routes) via ReactRouter.useBlocker;
 *  (b) wp-admin links outside the SPA root (#pressedmail-plugin lives inside
 *      the wp-admin document) via a capture-phase click listener;
 *  (c) tab close / refresh / typed URLs via beforeunload (native browser
 *      prompt only, custom UI is impossible there).
 *
 * All three paths are no-ops while the composer is clean.
 */
export function ComposeNavigationBlocker() {
  // Defensive: useBlocker requires a data router. Same pattern as
  // settings-ui/use-unsaved-changes-guard.tsx (proven on this hash router).
  const dataRouterContextValue =
    "UNSAFE_DataRouterContext" in ReactRouter
      ? (
          ReactRouter as typeof ReactRouter & {
            UNSAFE_DataRouterContext?: React.Context<unknown>;
          }
        ).UNSAFE_DataRouterContext
      : fallbackDataRouterContext;
  const dataRouterContext = useContext(
    dataRouterContextValue ?? fallbackDataRouterContext,
  );

  const { isComposeDirty, requestNavigation } = useComposer();

  // (b) wp-admin link interception, same document, outside the SPA root.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        !isComposeDirty() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Generated composer exports use a temporary <a download> outside the
      // SPA root. That click downloads a file; it does not navigate away and
      // must never invoke the dirty-draft close guard.
      if (anchor.hasAttribute("download")) return;
      const root = document.getElementById("pressedmail-plugin");
      // In-SPA anchors are router navigations, handled by the route blocker.
      if (root?.contains(anchor)) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const destination = anchor.href;
      event.preventDefault();
      event.stopPropagation();
      requestNavigation(() => {
        window.location.href = destination;
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isComposeDirty, requestNavigation]);

  // (c) beforeunload fallback, native prompt for full page unloads.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isComposeDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isComposeDirty]);

  if (!dataRouterContext) {
    return null;
  }

  return <ComposeRouteBlocker />;
}

function ComposeRouteBlocker() {
  const { isComposeDirty, requestNavigation } = useComposer();

  // Function predicate: evaluated lazily at navigation time against the
  // compose form's dirty ref, no re-registration churn, and it coexists with
  // the settings-ui blocker (only one predicate is true at a time in
  // practice; both return false when their surface is clean).
  const blocker = ReactRouter.useBlocker(
    ({ currentLocation, nextLocation, historyAction }) => {
      // Consuming an incoming payload after Save, Discard or Keep Editing changes
      // only its URL. It must not ask to discard the same draft a second time.
      const isPayloadCleanup =
        historyAction === "REPLACE" &&
        currentLocation.pathname === "/compose" &&
        nextLocation.pathname === currentLocation.pathname &&
        nextLocation.hash === currentLocation.hash &&
        nextLocation.state === currentLocation.state &&
        nextLocation.search ===
          consumeComposeRouteSearch(currentLocation.search);
      return !isPayloadCleanup && isComposeDirty();
    },
  );
  const handledRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== "blocked" || handledRef.current) return;
    handledRef.current = true;
    requestNavigation(
      () => {
        handledRef.current = false;
        blocker.proceed?.();
      },
      {
        onCancel: () => {
          handledRef.current = false;
          blocker.reset?.();
        },
      },
    );
  }, [blocker, requestNavigation]);

  return null;
}

export default ComposeNavigationBlocker;
