import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EmailMessageTag } from "@/types";
import {
  EmailTagVisualIcon,
  emailTagSoftBadgeClassName,
  getEmailTagBadgeStyle,
  resolveEmailTagColor,
} from "./tag-visuals";

export { getEmailTagBadgeStyle, resolveEmailTagColor } from "./tag-visuals";

interface EmailTagBadgesProps {
  tags?: EmailMessageTag[];
  /** Max badges to show before collapsing into a "+N" indicator. */
  maxVisible?: number;
  /** Allow the +N indicator to reveal hidden badges in-place. */
  expandable?: boolean;
  /** Called when a tag badge is clicked. Makes badges render as buttons. */
  onTagClick?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  /** Called when the per-badge remove affordance is clicked. */
  onTagRemove?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  className?: string;
  testId?: string;
  dataTest?: string;
  wrap?: boolean;
}

interface EmailTagBadgeProps {
  tag: EmailMessageTag;
  onTagClick?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  onTagRemove?: (
    tag: EmailMessageTag,
    event: React.SyntheticEvent<HTMLElement>,
  ) => void;
  className?: string;
}

export function EmailTagBadge({
  tag,
  onTagClick,
  onTagRemove,
  className,
}: EmailTagBadgeProps) {
  const style = getEmailTagBadgeStyle(tag);
  const accent = resolveEmailTagColor(tag);
  const classes = cn(emailTagSoftBadgeClassName, className);

  if (onTagClick || onTagRemove) {
    return (
      <span
        className={cn(
          "w-fit shrink-0 overflow-hidden whitespace-nowrap transition-colors hover:opacity-85 focus-within:ring-2 focus-within:ring-ring",
          classes,
        )}
        style={style}
        title={tag.name}
        data-tag-color={accent}>
        <EmailTagVisualIcon />
        {onTagClick ? (
          <button
            type="button"
            className="min-w-0 truncate text-left focus-visible:outline-none"
            aria-label={`Filter by ${tag.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onTagClick(tag, event);
            }}>
            {tag.name}
          </button>
        ) : (
          <span className="min-w-0 truncate">{tag.name}</span>
        )}
        {onTagRemove ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove ${tag.name} tag`}
            onClick={(event) => {
              event.stopPropagation();
              onTagRemove(tag, event);
            }}>
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={classes}
      style={style}
      title={tag.name}
      data-tag-color={accent}>
      <EmailTagVisualIcon />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/**
 * Renders an email's applied tags as small colored badges. Accepts the
 * lightweight EmailMessageTag shape carried on inbox/message payloads, so it
 * can be used in list rows and the reading pane without a full Tag object.
 */
export function EmailTagBadges({
  tags,
  maxVisible = 3,
  expandable = false,
  onTagClick,
  onTagRemove,
  className,
  testId = "email-tag-badges",
  dataTest = testId,
  wrap = false,
}: EmailTagBadgesProps) {
  const [expanded, setExpanded] = React.useState(false);
  const uniqueTags = React.useMemo(() => {
    if (!tags?.length) return [];

    const seen = new Set<number>();
    return tags.filter((tag) => {
      if (seen.has(tag.id)) {
        return false;
      }
      seen.add(tag.id);
      return true;
    });
  }, [tags]);

  if (uniqueTags.length === 0) return null;

  const hasHiddenTags = Boolean(maxVisible && uniqueTags.length > maxVisible);
  const collapsedVisible = maxVisible
    ? uniqueTags.slice(0, maxVisible)
    : uniqueTags;
  const visible = expanded || !maxVisible ? uniqueTags : collapsedVisible;
  const leadingVisible = expanded && hasHiddenTags ? collapsedVisible : visible;
  const expandedExtra =
    expanded && hasHiddenTags ? uniqueTags.slice(maxVisible) : [];
  const extra = Math.max(0, uniqueTags.length - visible.length);

  return (
    <span
      data-testid={testId}
      data-test={dataTest}
      className={cn(
        wrap
          ? "flex min-w-0 max-w-full flex-wrap items-center gap-1"
          : "inline-flex shrink-0 items-center gap-1",
        className,
      )}>
      {leadingVisible.map((tag) => (
        <EmailTagBadge
          key={tag.id}
          tag={tag}
          onTagClick={onTagClick}
          onTagRemove={onTagRemove}
        />
      ))}
      {expanded && hasHiddenTags ? (
        <button
          type="button"
          className="rounded px-1 text-2xs text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Show fewer tags"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}>
          Less
        </button>
      ) : extra > 0 ? (
        expandable ? (
          <button
            type="button"
            className="rounded px-1 text-2xs text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Show ${extra} more tag`}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}>
            +{extra}
          </button>
        ) : (
          <span className="text-2xs text-muted-foreground">+{extra}</span>
        )
      ) : null}
      {expandedExtra.map((tag) => (
        <EmailTagBadge
          key={tag.id}
          tag={tag}
          onTagClick={onTagClick}
          onTagRemove={onTagRemove}
        />
      ))}
    </span>
  );
}

export default EmailTagBadges;
