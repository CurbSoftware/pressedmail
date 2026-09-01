import type { ComponentProps } from "react";

import { PressedMailLogo } from "@kit/ui/pressed-mail-logo";

import { cn } from "@/lib/utils";

type LogoProps = ComponentProps<"svg">;

export default function Logo({ className, ...props }: LogoProps) {
  return <PressedMailLogo className={cn("h-7 w-auto", className)} {...props} />;
}
