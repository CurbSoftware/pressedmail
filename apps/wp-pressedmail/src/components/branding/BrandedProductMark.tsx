"use client";

import { PressedMailLaunchIcon } from "@/components/Icons/PressedMailLaunchIcon";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useWhitelabelTheme } from "@/layouts/shared/hooks/useWhitelabelTheme";

export interface BrandedProductMarkProps {
  variant?: "logo" | "square";
  showName?: boolean;
  className?: string;
  imageClassName?: string;
  nameClassName?: string;
  testId?: string;
}

export function BrandedProductMark({
  variant = "logo",
  showName = true,
  className,
  imageClassName,
  nameClassName,
  testId = "branded-product-mark",
}: BrandedProductMarkProps) {
  const { resolvedTheme } = useTheme();
  const { logo, logoLight, pluginName, squareMark } = useWhitelabelTheme();
  const surfaceLogo =
    resolvedTheme === "dark" ? logo || logoLight : logoLight || logo;
  const assetUrl = variant === "square" ? squareMark : surfaceLogo;

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
      data-test={testId}
      data-testid={testId}>
      {assetUrl ? (
        <img
          src={assetUrl}
          alt={pluginName}
          className={cn("shrink-0 object-contain", imageClassName)}
        />
      ) : (
        <PressedMailLaunchIcon
          role="img"
          aria-label="PressedMail"
          className={cn("shrink-0", imageClassName)}
        />
      )}
      {showName ? (
        <span className={cn("truncate font-semibold", nameClassName)}>
          {pluginName}
        </span>
      ) : null}
    </span>
  );
}
