/**
 * Tag Selector Component
 *
 * Dropdown component for selecting and applying tags to messages.
 *
 * @since 1.1.0
 */

import React, { useState, useCallback } from "react";
import {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
} from "@kit/ui/plugin";
import { Tag as TagIcon, Plus, Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTags } from "../../context/tags";
import { TagBadge } from "./TagBadge";
import { getCacheService, getInboxService } from "@/services/implementations";
import type { EmailMessageTag } from "@/types";
import type { Tag } from "../../types/tags";
import {
  getMessageIdentityKey,
  parseMessageIdentityRef,
  type MessageIdentityRef,
} from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
  type StoragePrincipal,
} from "@/lib/principal-storage";

interface TagSelectorProps {
  selectedTags: Tag[];
  onTagToggle: (tag: Tag, isSelected: boolean) => void;
  onCreateTag?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Tag Selector Component
 *
 * Provides a dropdown for selecting multiple tags.
 */
export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagToggle,
  onCreateTag,
  disabled = false,
  className,
}) => {
  const { tags, capabilities, loading } = useTags();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedTagIds = new Set(selectedTags.map((t) => t.id));

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleTagClick = useCallback(
    (tag: Tag) => {
      const isSelected = selectedTagIds.has(tag.id);
      onTagToggle(tag, !isSelected);
    },
    [selectedTagIds, onTagToggle],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5",
            "text-sm font-medium transition-colors",
            "bg-muted hover:bg-accent",
            "text-foreground",
            // The popover trigger used to inject a focus ring; it no longer
            // styles asChild children, so the control carries its own.
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
          aria-label="Select tags">
          <TagIcon size={16} />
          <span>
            {selectedTags.length > 0 ? `${selectedTags.length} Tags` : "Tags"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "z-50 w-64 rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg border-border",
          "animate-in fade-in-0 zoom-in-95",
        )}
        sideOffset={5}
        align="start">
        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <input
              autoComplete="off"
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-8 pr-3 py-1.5 text-sm rounded-md",
                "bg-muted",
                "border border-border",
                "focus:outline-none focus:ring-2 focus:ring-ring",
              )}
            />
          </div>
        </div>

        {/* Tag List */}
        <div className="max-h-64 overflow-y-auto p-1">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              Loading tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              {searchQuery ? "No tags found" : "No tags created yet"}
            </div>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                    "text-sm transition-colors",
                    "hover:bg-accent",
                    isSelected && "bg-primary/10",
                  )}>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isSelected && <Check size={14} className="text-primary" />}
                </button>
              );
            })
          )}
        </div>

        {/* Create New Tag */}
        {onCreateTag && capabilities?.create && (
          <div className="p-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateTag();
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
                "text-sm text-primary",
                "hover:bg-primary/10",
                "transition-colors",
              )}>
              <Plus size={14} />
              <span>Create new tag</span>
            </button>
          </div>
        )}

        <PopoverArrow className="fill-popover" />
      </PopoverContent>
    </Popover>
  );
};

/**
 * Inline Tag Selector for message rows
 */
interface InlineTagSelectorProps {
  accountId: number;
  messageUid: string;
  folder: string;
  uidValidity: string;
  messageTags?: EmailMessageTag[];
  onTagsChange?: (tags: EmailMessageTag[]) => void;
  className?: string;
  /**
   * Optional custom trigger element. When provided it replaces the default
   * icon button (rendered via `<PopoverTrigger asChild>`), letting callers
   * supply e.g. a ribbon-style icon-over-label button. Falls back to the
   * default tag icon button when omitted.
   */
  trigger?: React.ReactNode;
}

function toMessageTag(tag: Tag | EmailMessageTag): EmailMessageTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
  };
}

function toFullTag(tag: Tag | EmailMessageTag): Tag {
  return {
    user_id: 0,
    account_id: null,
    ai_prompt: "",
    ai_auto_tag_enabled: false,
    sort_order: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...tag,
    icon: tag.icon ?? null,
  };
}

const InlineMessageTagSelector: React.FC<
  InlineTagSelectorProps & { identity: MessageIdentityRef | null }
> = ({ identity, messageTags, onTagsChange, className, trigger }) => {
  const { tags, assignTag, removeTag, getMessageTags } = useTags();
  const [selectedTags, setSelectedTags] = useState<Tag[]>(() =>
    (identity ? (messageTags ?? []) : []).map(toFullTag),
  );
  const [loaded, setLoaded] = useState(Boolean(identity && messageTags));
  const [pending, setPending] = useState(false);
  const loading = React.useRef(false);
  const mutating = React.useRef(false);
  const mounted = React.useRef(true);
  const localMessageId = getMessageIdentityKey(identity);

  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isCurrent = useCallback(
    (principal: StoragePrincipal | null) =>
      mounted.current && isRequestPrincipalCurrent(principal),
    [],
  );

  React.useEffect(() => {
    setSelectedTags((localMessageId ? (messageTags ?? []) : []).map(toFullTag));
    setLoaded(Boolean(localMessageId && messageTags));
  }, [localMessageId, messageTags]);

  const updateLocalMessageTags = useCallback(
    (nextTags: Tag[], principal: StoragePrincipal | null) => {
      if (!localMessageId || !isCurrent(principal)) return;
      const messageTagProjection = nextTags.map(toMessageTag);
      onTagsChange?.(messageTagProjection);
      if (!isCurrent(principal)) return;
      getInboxService().updateMessage(localMessageId, {
        tags: messageTagProjection,
      });
    },
    [localMessageId, onTagsChange, isCurrent],
  );

  // Load message tags when popover opens
  const handleOpenChange = useCallback(
    async (open: boolean) => {
      const principal = captureRequestPrincipal();
      if (
        open &&
        identity &&
        !loaded &&
        !loading.current &&
        isCurrent(principal)
      ) {
        loading.current = true;
        try {
          const messageTags = await getMessageTags(
            identity.accountId,
            identity.uid,
            identity.folder,
            identity.uidValidity,
          );
          if (!isCurrent(principal)) return;
          setSelectedTags(messageTags);
          setLoaded(true);
        } catch (error) {
          if (isCurrent(principal))
            console.error("Failed to load message tags:", error);
        } finally {
          loading.current = false;
        }
      }
    },
    [identity, getMessageTags, loaded, isCurrent],
  );

  const handleTagToggle = useCallback(
    async (tag: Tag, shouldSelect: boolean) => {
      const principal = captureRequestPrincipal();
      if (!identity || !loaded || mutating.current || !isCurrent(principal))
        return;
      mutating.current = true;
      setPending(true);
      const previousTags = selectedTags;
      const nextTags = shouldSelect
        ? [...selectedTags.filter((item) => item.id !== tag.id), tag]
        : selectedTags.filter((t) => t.id !== tag.id);

      setSelectedTags(nextTags);

      try {
        updateLocalMessageTags(nextTags, principal);
        if (!isCurrent(principal)) return;
        if (shouldSelect) {
          await assignTag(
            tag.id,
            identity.accountId,
            identity.uid,
            identity.folder,
            identity.uidValidity,
          );
        } else {
          await removeTag(
            tag.id,
            identity.accountId,
            identity.uid,
            identity.folder,
            identity.uidValidity,
          );
        }
      } catch (error) {
        if (!isCurrent(principal)) return;
        setSelectedTags(previousTags);
        updateLocalMessageTags(previousTags, principal);
        console.error("Failed to toggle tag:", error);
      } finally {
        mutating.current = false;
        if (isCurrent(principal)) {
          setPending(false);
        } else if (isRequestPrincipalCurrent(principal)) {
          // The old row may still have an optimistic projection. Do not restore
          // its snapshot over a newer edit; reload it when next read instead.
          // List scopes also include combined accounts and filtered virtual views.
          const cache = getCacheService();
          cache.invalidateMessages({});
          if (isRequestPrincipalCurrent(principal)) {
            cache.invalidateMessageDetail(
              String(identity.accountId),
              identity.folder,
              localMessageId,
            );
          }
        }
      }
    },
    [
      identity,
      loaded,
      assignTag,
      removeTag,
      selectedTags,
      updateLocalMessageTags,
      isCurrent,
      localMessageId,
    ],
  );

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            disabled={!identity}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedTags.length > 0 && "text-primary",
              className,
            )}
            onClick={(event) => event.stopPropagation()}
            aria-label="Manage tags">
            <TagIcon size={16} />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "z-50 w-56 rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg border-border",
          "animate-in fade-in-0 zoom-in-95",
        )}
        sideOffset={5}
        align="end">
        <div className="p-2">
          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 px-2">
              {selectedTags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  removable
                  onRemove={() => handleTagToggle(tag, false)}
                />
              ))}
            </div>
          )}

          {/* Available Tags */}
          <div className="max-h-48 overflow-y-auto">
            {tags
              .filter((tag) => !selectedTags.some((t) => t.id === tag.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  disabled={!identity || !loaded || pending}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleTagToggle(tag, true);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                    "text-sm transition-colors",
                    "hover:bg-accent",
                  )}>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
              ))}
          </div>
        </div>

        <PopoverArrow className="fill-popover" />
      </PopoverContent>
    </Popover>
  );
};

export const InlineTagSelector: React.FC<InlineTagSelectorProps> = (props) => {
  const identity = parseMessageIdentityRef({
    accountId: props.accountId,
    uid: props.messageUid,
    folder: props.folder,
    uidValidity: props.uidValidity,
  });
  // A row reused for another mailbox must not reuse loaded tags or pending work.
  return (
    <InlineMessageTagSelector
      key={getMessageIdentityKey(identity)}
      {...props}
      identity={identity}
    />
  );
};

export default TagSelector;
