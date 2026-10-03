import { useFeaturesOptional } from "@/context/features/FeaturesContext";
import type { PlateEmailEditorSurface } from "@/lib/email-surfaces";

/**
 * Whether saved blocks are on for a surface: emails and templates, for a licence
 * that has Templates. The one rule the toolbar button, the slash menu and the
 * Settings toolbar dialog share, so none of them can offer what another hides.
 * Free folds it to false, and its toolbar item is filtered out with it.
 *
 * Read through `useFeaturesOptional`: outside a FeaturesProvider there are no
 * features, which fails closed.
 */
export function useContentBlocksEnabled(surface: PlateEmailEditorSurface): boolean {
  const features = useFeaturesOptional();
  return (
    __ENABLE_TEMPLATES__ &&
    (surface === "email" || surface === "template") &&
    Boolean(features?.hasFeatureAccess?.("templates"))
  );
}
