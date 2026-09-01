/**
 * Tag Badge Component
 *
 * Display component for rendering a tag as a badge.
 *
 * @since 1.1.0
 */

import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Tag } from "../../types/tags";
import {
  EmailTagVisualIcon,
  emailTagSoftBadgeClassName,
  getEmailTagBadgeStyle,
  resolveEmailTagColor,
} from "./tag-visuals";

interface TagBadgeProps {
  tag: Tag;
  size?: "sm" | "md" | "lg";
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * Tag Badge Component
 *
 * Renders a tag as a colored badge with optional remove button.
 */
export const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  size = "md",
  removable = false,
  onRemove,
  onClick,
  className,
}) => {
  const sizeClasses = {
    sm: "",
    md: "",
    lg: "",
  };

  const isClickable = onClick !== undefined;
  const style = getEmailTagBadgeStyle(tag);
  const accent = resolveEmailTagColor(tag);

  return (
    <span
      className={cn(
        emailTagSoftBadgeClassName,
        "transition-opacity",
        sizeClasses[size],
        isClickable && "cursor-pointer hover:opacity-80",
        className,
      )}
      style={style}
      data-tag-color={accent}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }>
      <EmailTagVisualIcon />
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {removable && onRemove && (
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tag.name} tag`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};

/**
 * Tag Badge List Component
 *
 * Renders a list of tags as badges.
 */
interface TagBadgeListProps {
  tags: Tag[];
  size?: "sm" | "md" | "lg";
  removable?: boolean;
  onRemove?: (tag: Tag) => void;
  onClick?: (tag: Tag) => void;
  maxVisible?: number;
  className?: string;
}


export default TagBadge;
