"use client";

/**
 * Default Layout Component
 *
 * Roundcube-style layout with nested panels:
 * - Column 1 (resizable): Folder hierarchy pane
 * - Combined area (resizable):
 *   - Full-width toolbar + search (spans message list + reading pane)
 *   - Column 2 (resizable): Message list with pagination
 *   - Column 3 (resizable): Reading pane / compose
 *
 * Note: GlobalNavBar is rendered by LayoutNavigationShell at the
 * ApplicationLayout level, so it persists across all pages.
 *
 * Available in Free + Pro tiers.
 *
 * @since 1.2.0
 * @updated 3.0.0 - Restructured from 3-pane to 4-column Roundcube layout
 * @updated 3.1.0 - Nested panels for full-width toolbar spanning list + reading
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";

import { RightPaneContainer } from "@/components/inbox/RightPaneContainer";
import { ReadingPaneStateProvider } from "@/components/inbox/reading-pane-state";

import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import { useMobile } from "@/hooks/useMobile";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { emailListSortStateFromPreference } from "@/lib/preference-behavior";
import { cn } from "@/lib/utils";
import type { MailProps } from "@/types";
import type { LayoutConfig } from "@/types/features";
import { EmailSelectionProvider } from "@/context/selection";
import { ScopeChangeSelectionReset } from "@/components/inbox/ScopeChangeSelectionReset";
import { EmailDragDropProvider } from "@/components/shared/drag-drop";
import {
  readPanelLayoutFromCookie,
  writePanelLayoutCookie,
} from "@/layouts/shared/utils/panelLayout";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  TooltipProvider,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@kit/ui/plugin";

import { BulkActionBar } from "@/components/inbox/BulkActionBar";
import { TaskProgressBanner } from "@/components/inbox/TaskProgressBanner";
import { FolderRecoveryActions } from "@/components/inbox/FolderRecoveryActions";
import { FolderPane } from "./FolderPane";
import { MessageListPane } from "./MessageListPane";
import { MessageListToolbar } from "./MessageListToolbar";
import type { ListOptions } from "./menus/ListOptionsModal";

const FOLDER_PANE_COLLAPSE_THRESHOLD = 13;

export interface DefaultLayoutProps extends Omit<MailProps, "mails"> {
  /** Optional messages (layouts get these from context) */
  mails?: MailProps["mails"];
  layoutConfig?: LayoutConfig;
}

export function DefaultLayout({
  accounts,
  defaultLayout = [25, 35, 40],
  defaultCollapsed = false,
  navCollapsedSize,
  showComposer = true,
  layoutConfig,
}: DefaultLayoutProps) {
  // Outer panel layout: [folder%, combined%]
  const outerDefault = React.useMemo(
    () => [
      defaultLayout[0],
      (defaultLayout[1] ?? 35) + (defaultLayout[2] ?? 40),
    ],
    [defaultLayout],
  );
  const resolvedOuterLayout = React.useMemo(
    () =>
      readPanelLayoutFromCookie("pressedm", {
        expectedLength: 2,
        fallbackToShared: false,
      }) ?? outerDefault,
    [outerDefault],
  );

  // Inner panel layout: [list%, reading%]
  const innerDefault = React.useMemo(() => {
    const list = defaultLayout[1] ?? 35;
    const reading = defaultLayout[2] ?? 40;
    const total = list + reading;
    return [(list / total) * 100, (reading / total) * 100];
  }, [defaultLayout]);
  const resolvedInnerLayout = React.useMemo(
    () =>
      readPanelLayoutFromCookie("default-inner", {
        expectedLength: 2,
        fallbackToShared: false,
      }) ?? innerDefault,
    [innerDefault],
  );

  // Track folder pane size to auto-collapse when it reaches the icon rail.
  const [folderPaneSize, setFolderPaneSize] = React.useState(
    resolvedOuterLayout[0] ?? outerDefault[0] ?? 25,
  );
  const isFolderCollapsed =
    defaultCollapsed || folderPaneSize < FOLDER_PANE_COLLAPSE_THRESHOLD;

  const [showFolderSheet, setShowFolderSheet] = React.useState(false);

  const { selectedMessage } = useMailOperations();
  const { isDesktop } = useMobile();
  const { preferences } = useUserPreferences();

  // Toolbar state (lifted from MessageListPane so toolbar can span both columns)
  const [listOptions, setListOptions] = React.useState<ListOptions>(() => {
    const sort = emailListSortStateFromPreference(
      preferences.email_list_default_sort ?? "newest",
    );
    return {
      sortColumn: sort.column,
      sortOrder: sort.order,
      listMode: "list",
      showDetails: false,
    };
  });
  React.useEffect(() => {
    const sort = emailListSortStateFromPreference(
      preferences.email_list_default_sort ?? "newest",
    );
    setListOptions((current) => ({
      ...current,
      sortColumn: sort.column,
      sortOrder: sort.order,
    }));
  }, [preferences.email_list_default_sort]);
  const [threadsEnabled, setThreadsEnabled] = React.useState(false);
  const [currentPageIds, setCurrentPageIds] = React.useState<
    (string | number)[]
  >([]);

  const handleListOptionsChange = React.useCallback((options: ListOptions) => {
    setListOptions(options);
    setThreadsEnabled(options.listMode === "threads");
  }, []);

  // Shared reading pane with mode switcher (reading vs compose).
  const readingPaneContent = (
    <RightPaneContainer
      selectedMessage={selectedMessage}
      className="h-full"
      showActionBar
    />
  );

  // List controls toolbar (above message list column)
  const listToolbar = (
    <MessageListToolbar
      listOptions={listOptions}
      onListOptionsChange={handleListOptionsChange}
      currentPageIds={currentPageIds}
    />
  );

  // Desktop layout: outer group [folder | combined]
  const desktopLayout = (
    <div className="flex h-full min-h-0 w-full">
      {/* Outer panels: Folder | Combined area */}
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          writePanelLayoutCookie("pressedm", sizes, { cleanupShared: true });
          if (sizes[0] !== undefined) {
            setFolderPaneSize(sizes[0]);
          }
        }}
        className="flex-1 min-h-0 bg-background">
        {/* Column 2: Folder Hierarchy */}
        <ResizablePanel
          id="folder"
          defaultSize={resolvedOuterLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={12}
          maxSize={25}
          className={cn(
            "flex bg-card min-h-0 flex-col overflow-hidden",
            isFolderCollapsed &&
              "min-w-12.5 transition-all duration-300 ease-in-out",
          )}>
          <FolderPane isCollapsed={isFolderCollapsed} />
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Combined: Toolbar + inner panels (message list | reading pane) */}
        <ResizablePanel
          id="combined"
          defaultSize={resolvedOuterLayout[1]}
          minSize={55}
          className="flex min-h-0 w-full flex-col overflow-hidden bg-card">
          <EmailSelectionProvider>
            <ScopeChangeSelectionReset />
            {/* Inner panels: message list | reading pane (each with own toolbar) */}
            <ResizablePanelGroup
              direction="horizontal"
              onLayout={(sizes: number[]) => {
                writePanelLayoutCookie("default-inner", sizes);
              }}
              className="flex-1 min-h-0">
              {/* Column 3: List toolbar + BulkActionBar + Message List */}
              <ResizablePanel
                id="list"
                defaultSize={resolvedInnerLayout[0]}
                minSize={25}
                maxSize={55}
                className="flex min-h-0 w-full flex-col overflow-hidden">
                {listToolbar}
                <FolderRecoveryActions />
                <BulkActionBar />
                <TaskProgressBanner />
                <MessageListPane
                  onShowFolderSheet={() => setShowFolderSheet(true)}
                  listOptions={listOptions}
                  threadsEnabled={threadsEnabled}
                  onCurrentPageIdsChange={setCurrentPageIds}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />

              {/* Column 4: Reading toolbar + Message Detail / Compose */}
              <ResizablePanel
                id="reading"
                defaultSize={resolvedInnerLayout[1]}
                minSize={30}
                className="flex min-h-0 w-full flex-col overflow-hidden">
                {readingPaneContent}
              </ResizablePanel>
            </ResizablePanelGroup>
          </EmailSelectionProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );

  // Tablet layout: split toolbars per column
  const tabletLayout = (
    <div className="flex h-full min-h-0 w-full">
      <EmailSelectionProvider>
        <ScopeChangeSelectionReset />
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0 bg-background">
          <ResizablePanel
            id="tablet-list"
            defaultSize={40}
            minSize={25}
            maxSize={50}
            className="flex min-h-0 w-full flex-col overflow-hidden bg-card">
            {listToolbar}
            <FolderRecoveryActions />
            <BulkActionBar />
            <TaskProgressBanner />
            <MessageListPane
              onShowFolderSheet={() => setShowFolderSheet(true)}
              listOptions={listOptions}
              threadsEnabled={threadsEnabled}
              onCurrentPageIdsChange={setCurrentPageIds}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="tablet-reading"
            defaultSize={60}
            minSize={40}
            className="flex min-h-0 w-full flex-col overflow-hidden bg-card">
            {readingPaneContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      </EmailSelectionProvider>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <EmailDragDropProvider>
        <ReadingPaneStateProvider selectedMessage={selectedMessage}>
          <div className="relative h-full min-h-0 w-full overflow-hidden">
            {isDesktop ? desktopLayout : tabletLayout}
          </div>
        </ReadingPaneStateProvider>

        {/* Folder Sheet overlay for narrow screens / tablet */}
        <Sheet open={showFolderSheet} onOpenChange={setShowFolderSheet}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>{__("Folders", "pressedmail")}</SheetTitle>
            </SheetHeader>
            <div className="flex h-[calc(100%-3.5rem)] flex-col">
              <FolderPane isCollapsed={false} />
            </div>
          </SheetContent>
        </Sheet>
      </EmailDragDropProvider>
    </TooltipProvider>
  );
}

export default DefaultLayout;
