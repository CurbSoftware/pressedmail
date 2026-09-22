"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Calendar, Mail, Users } from "lucide-react";

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

/**
 * The scope picker of the header search: a plain outline icon button that
 * opens the Mail / Contacts / Calendar menu. With one scope there is nothing
 * to pick, so it renders nothing rather than a disabled button.
 */
export function SearchScopeDropdown({
  value,
  onChange,
  options = SEARCH_SCOPE_OPTIONS,
  className,
}: SearchScopeDropdownProps) {
  if (options.length <= 1) return null;

  const active =
    options.find((option) => option.value === value) ?? options[0]!;
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={className}
          aria-label={__("Change search scope", "pressedmail")}
          data-test="header-search-scope-trigger"
          data-testid="header-search-scope-trigger">
          <ActiveIcon
            className="text-primary"
            data-test="header-search-active-scope-icon"
            data-testid="header-search-active-scope-icon"
          />
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
