"use client";

import { useEffect } from "react";
import useLocalStorage from "@/context/useLocalStorage";
import {
  applyFontFamily,
  applyFontSize,
} from "@/themes/core/utils/css-variable-injector";
import {
  getUiFontOptions,
  resolveUiFontOption,
} from "@/lib/font-registry";

const UI_FONT_OPTIONS = getUiFontOptions();

type FontStackOption = {
  id: string;
  name: string;
  description: string;
  value: string;
};

function toFontStackOption(option: {
  id: string;
  label: string;
  description: string;
  cssFontFamily: string | null;
}): FontStackOption {
  return {
    id: option.id,
    name: option.label,
    description: option.description,
    value: option.cssFontFamily ?? "system-ui, sans-serif",
  };
}

/**
 * Font Stack Options
 *
 * UI font stacks for different reading preferences:
 * Uses the shared PressedMail font registry so theme typography and composer
 * font choices resolve labels, aliases, and CSS stacks consistently.
 */
export const FONT_STACKS: Record<string, FontStackOption> = Object.fromEntries(
  UI_FONT_OPTIONS.map((option) => {
    const stack = toFontStackOption(option);
    return [stack.id, stack];
  }),
);

/**
 * Font Size Options
 *
 * Five accessible baseline sizes for different reading preferences. The first
 * three tiers keep the original CSS values (relabelled a tier smaller); the two
 * largest tiers extend the same +2px scale. Every text/icon token scales off
 * `--pm-font-size` via calc() in tailwind-base.css, so no extra CSS is needed.
 * Keys are semantic (xs/sm/md/lg/xl) to avoid collision with the legacy numeric
 * ids during migration.
 */
export const FONT_SIZES = {
  xs: { id: "xs", name: "Extra Small", value: "16px" },
  sm: { id: "sm", name: "Small", value: "18px" },
  md: { id: "md", name: "Medium", value: "20px" },
  lg: { id: "lg", name: "Large", value: "22px" },
  xl: { id: "xl", name: "Extra Large", value: "24px" },
} as const;

export type FontStackId = string;
export type FontSizeId = keyof typeof FONT_SIZES;

/**
 * Validate and normalize font stack ID, falling back to default if invalid
 */
function getValidFontStack(value: string): FontStackId {
  return resolveUiFontOption(value)?.id ?? "system-ui";
}

/**
 * Validate and normalize font size ID, falling back to default if invalid.
 * Also handles migration from legacy values (small/medium/large).
 */
function getValidFontSize(value: string): FontSizeId {
  if (value in FONT_SIZES) {
    return value as FontSizeId;
  }
  // Migrate legacy ids to the tier with the SAME rendered px (no visual change).
  // Semantic labels from before the tier shift:
  if (value === "small") return "xs"; // 16px
  if (value === "medium") return "sm"; // 18px
  if (value === "large") return "md"; // 20px
  // Old numeric ids ("14"/"16"/"18") whose rendered px were 16/18/20:
  if (value === "14") return "xs"; // 16px
  if (value === "16") return "sm"; // 18px
  if (value === "18") return "md"; // 20px
  return "sm"; // default: keep the historical 18px baseline
}

/**
 * useTypographySettings Hook
 *
 * Manages font stack and font size settings with localStorage persistence.
 * Automatically applies settings via CSS variables on change.
 *
 * @returns Typography settings state and setters
 */
export function useTypographySettings() {
  const [rawFontStack, setFontStack] = useLocalStorage<string>(
    "typography-font-stack",
    "system-ui",
  );
  const [rawFontSize, setFontSize] = useLocalStorage<string>(
    "typography-font-size",
    "sm",
  );

  // Validate stored values (handles legacy/invalid values)
  const fontStack = getValidFontStack(rawFontStack);
  const fontSize = getValidFontSize(rawFontSize);

  // Apply settings via CSS variables on mount and when settings change
  useEffect(() => {
    applyFontFamily(
      FONT_STACKS[fontStack]?.value ?? "system-ui, sans-serif",
    );
    applyFontSize(FONT_SIZES[fontSize].value);
  }, [fontStack, fontSize]);

  return {
    fontStack,
    setFontStack,
    fontSize,
    setFontSize,
    fontStackOptions: UI_FONT_OPTIONS.map(toFontStackOption),
    fontSizeOptions: Object.values(FONT_SIZES),
  };
}

export default useTypographySettings;
