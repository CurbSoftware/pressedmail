"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Calendar, ChevronDown, Mail, Users } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@kit/ui/plugin";

import type { HeaderSearchScope } from "@/types/search";

export interface SearchScopeOption {
  value: HeaderSearchScope;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SEARCH_SCOPE_OPTIONS: SearchScopeOption[] = [
  { value: "emails", label: "Mail", icon: Mail },
  { value: "contacts", label: "Contacts", icon: Users },
  { value: "calendar", label: "Calendar", icon: Calendar },
];

interface SearchScopeDropdownProps {
  value: HeaderSearchScope;
  onChange: (next: HeaderSearchScope) => void;
  options?: SearchScopeOption[];
  className?: string;
}

export function SearchScopeDropdown({
  value,
  onChange,
  options = SEARCH_SCOPE_OPTIONS,
  className,
}: SearchScopeDropdownProps) {
  const active =
    options.find((option) => option.value === value) ??
    options[0] ??
    SEARCH_SCOPE_OPTIONS[0]!;
  const ActiveIcon = active.icon;

  if (options.length <= 1) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 shrink-0 gap-0.5 px-0 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          className,
        )}
        aria-label={__("Search scope", "pressedmail")}
        data-test="header-search-scope-trigger"
        data-testid="header-search-scope-trigger"
        disabled>
        <ActiveIcon
          className="h-5 w-5 text-primary"
          data-test="header-search-active-scope-icon"
          data-testid="header-search-active-scope-icon"
        />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-11 shrink-0 gap-px py-2 pl-2 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            __IS_PRO__ &&
              "bg-clip-border hover:bg-accent data-[state=open]:bg-accent",
            className,
          )}
          aria-label={__("Change search scope", "pressedmail")}
          data-test="header-search-scope-trigger"
          data-testid="header-search-scope-trigger">
          <ActiveIcon
            className="size-[18px] text-primary"
            data-test="header-search-active-scope-icon"
            data-testid="header-search-active-scope-icon"
          />
          <ChevronDown className="size-2.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-44">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              data-test={`header-search-scope-${option.value}`}
              data-testid={`header-search-scope-${option.value}`}
              onSelect={() => onChange(option.value)}
              className={cn(
                "gap-2",
                isActive && "bg-accent text-accent-foreground",
              )}>
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SearchScopeDropdown;
