"use client";

import { __ } from "@wordpress/i18n";
import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";

import { useAppContext } from "@/context/AppProvider";

import { buttonVariants } from "@kit/ui/plugin";
export interface NavLink {
  title: string;
  label?: string;
  icon: LucideIcon;
  variant: "default" | "ghost";
  onClick?: () => void;
  /** Whether this is an administrative folder (Archive, Junk, Trash) - uses muted styling */
  isAdmin?: boolean;
}

export interface NavProps {
  isCollapsed: boolean;
  links: NavLink[];
}

export function Nav({ links, isCollapsed }: NavProps) {
  const { setIsAddAccount, removeSelectedAccount, selectedAccount } =
    useAppContext();

  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2">
      <nav
        className="grid gap-1 px-2 group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-2"
        data-test="folder-list">
        {links.map((link, index) =>
          isCollapsed ? (
            <PressedTooltip
              key={index}
              content={
                link.label ? `${link.title} • ${link.label}` : link.title
              }
              side="right">
              <a
                href="#"
                data-test="folder-item"
                data-folder={link.title}
                onClick={(event) => {
                  event.preventDefault();
                  if (link.onClick) {
                    link.onClick();
                  }
                  if (link.title.includes("Delete Account")) {
                    if (
                      selectedAccount &&
                      window.confirm(
                        __(
                          "Are you sure you want to delete this account?",
                          "pressedmail",
                        ),
                      )
                    ) {
                      removeSelectedAccount(selectedAccount);
                    }
                  } else if (link.title.includes("Account")) {
                    setIsAddAccount(true);
                  }
                }}
                className={cn(
                  buttonVariants({ variant: link.variant, size: "icon" }),
                  "h-9 w-9 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  link.variant === "default" &&
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  link.variant === "ghost" && "text-foreground",
                )}>
                <link.icon className="h-4 w-4" />
                <span className="sr-only">{link.title}</span>
              </a>
            </PressedTooltip>
          ) : (
            <a
              key={index}
              href="#"
              data-test="folder-item"
              data-folder={link.title}
              onClick={(event) => {
                event.preventDefault();
                if (link.onClick) {
                  link.onClick();
                }
                if (link.title.includes("Delete Account")) {
                  if (
                    selectedAccount &&
                    window.confirm(
                      __(
                        "Are you sure you want to delete this account?",
                        "pressedmail",
                      ),
                    )
                  ) {
                    removeSelectedAccount(selectedAccount);
                  }
                } else if (link.title.includes("Account")) {
                  setIsAddAccount(true);
                }
              }}
              className={cn(
                buttonVariants({ variant: link.variant, size: "sm" }),
                "h-9 justify-start outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                link.variant === "default" &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                // Ensure proper text color for ghost variant in all themes/dark mode
                link.variant === "ghost" && "text-foreground",
                // Muted styling for administrative folders (overrides base text-foreground)
                link.isAdmin &&
                  link.variant !== "default" &&
                  "text-muted-foreground",
              )}>
              <link.icon className="mr-2 h-4 w-4" />
              {link.title}
              {link.label && (
                <span
                  className={cn(
                    "ml-auto text-xs",
                    link.variant === "default" && "text-primary-foreground",
                  )}>
                  {link.label}
                </span>
              )}
            </a>
          ),
        )}
      </nav>
    </div>
  );
}
