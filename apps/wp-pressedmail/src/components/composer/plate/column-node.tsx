'use client';

import { __ } from '@wordpress/i18n';

import * as React from 'react';
import { setColumns } from '@kit/plate/layout';
import { Trash2Icon, type LucideProps } from 'lucide-react';
import type { TColumnElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import {
  PlateElement,
  useEditorRef,
  useEditorSelector,
  useElement,
  useFocusedLast,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
} from '@kit/plate/react';

import {
  Button,
  Popover,
  PopoverAnchor,
  Separator,
} from "@kit/ui/plugin";
import {
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";

import { cn } from '@/lib/utils';

/**
 * Interactive column item. Email serialization uses the table-based static
 * variant (column-node-static.tsx); the flex layout here is editor-only.
 * Resize/drag chrome from the playground is intentionally omitted (no
 * @platejs/resizable dependency); column widths are set via the preset toolbar.
 */
export function ColumnElement(props: PlateElementProps<TColumnElement>) {
  const { width } = props.element;
  const readOnly = useReadOnly();

  return (
    <div className="relative min-w-0" style={{ width: width ?? '100%' }}>
      <PlateElement {...props} className="h-full px-2 pt-2">
        <div
          className={cn(
            'relative h-full border border-transparent p-1.5',
            !readOnly && 'rounded-lg border-dashed border-border',
          )}
        >
          {props.children}
        </div>
      </PlateElement>
    </div>
  );
}

export function ColumnGroupElement(props: PlateElementProps) {
  return (
    <PlateElement className="mb-2" {...props}>
      <ColumnFloatingToolbar>
        <div className="flex size-full rounded">{props.children}</div>
      </ColumnFloatingToolbar>
    </PlateElement>
  );
}

function ColumnFloatingToolbar({ children }: React.PropsWithChildren) {
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const element = useElement<TColumnElement>();
  const { props: buttonProps } = useRemoveNodeButton({ element });
  const selected = useSelected();
  const isCollapsed = useEditorSelector((e) => e.api.isCollapsed(), []);
  const isFocusedLast = useFocusedLast();

  const open = isFocusedLast && !readOnly && selected && isCollapsed;

  const onColumnChange = (widths: string[]) => {
    setColumns(editor, { at: element, widths });
  };

  return (
    <Popover modal={false} open={open}>
      <PopoverAnchor>{children}</PopoverAnchor>
      <PressedPopoverContent
        size="menu"
        align="center"
        className="w-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        side="top"
        sideOffset={10}
      >
        <div className="box-content flex h-8 items-center">
          <Button
            className="size-8"
            aria-label={__('Two equal columns', 'pressedmail')}
            onClick={() => onColumnChange(['50%', '50%'])}
            variant="ghost"
          >
            <DoubleColumnOutlined />
          </Button>
          <Button
            className="size-8"
            aria-label={__('Three equal columns', 'pressedmail')}
            onClick={() => onColumnChange(['33%', '33%', '33%'])}
            variant="ghost"
          >
            <ThreeColumnOutlined />
          </Button>
          <Button
            className="size-8"
            aria-label={__('Wider left column', 'pressedmail')}
            onClick={() => onColumnChange(['70%', '30%'])}
            variant="ghost"
          >
            <RightSideDoubleColumnOutlined />
          </Button>
          <Button
            className="size-8"
            aria-label={__('Wider right column', 'pressedmail')}
            onClick={() => onColumnChange(['30%', '70%'])}
            variant="ghost"
          >
            <LeftSideDoubleColumnOutlined />
          </Button>
          <Button
            className="size-8"
            aria-label={__('Wider middle column', 'pressedmail')}
            onClick={() => onColumnChange(['25%', '50%', '25%'])}
            variant="ghost"
          >
            <DoubleSideDoubleColumnOutlined />
          </Button>

          <Separator className="mx-1 h-6" orientation="vertical" />
          <Button
            aria-label={__('Delete columns', 'pressedmail')}
            className="size-8"
            variant="ghost"
            {...buttonProps}
          >
            <Trash2Icon />
          </Button>
        </div>
      </PressedPopoverContent>
    </Popover>
  );
}

const DoubleColumnOutlined = (props: LucideProps) => (
  <svg fill="none" height="16" viewBox="0 0 16 16" width="16" {...props}>
    <path
      clipRule="evenodd"
      d="M8.5 3H13V13H8.5V3ZM7.5 2H8.5H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H8.5H7.5H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H7.5ZM7.5 13H3L3 3H7.5V13Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const ThreeColumnOutlined = (props: LucideProps) => (
  <svg fill="none" height="16" viewBox="0 0 16 16" width="16" {...props}>
    <path
      clipRule="evenodd"
      d="M9.25 3H6.75V13H9.25V3ZM9.25 2H6.75H5.75H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H5.75H6.75H9.25H10.25H13C13.5523 14 14 13.5523 14 13V3C14 2.44772 13.5523 2 13 2H10.25H9.25ZM10.25 3V13H13V3H10.25ZM3 13H5.75V3H3L3 13Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const RightSideDoubleColumnOutlined = (props: LucideProps) => (
  <svg fill="none" height="16" viewBox="0 0 16 16" width="16" {...props}>
    <path
      clipRule="evenodd"
      d="M11.25 3H13V13H11.25V3ZM10.25 2H11.25H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H11.25H10.25H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H10.25ZM10.25 13H3L3 3H10.25V13Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const LeftSideDoubleColumnOutlined = (props: LucideProps) => (
  <svg fill="none" height="16" viewBox="0 0 16 16" width="16" {...props}>
    <path
      clipRule="evenodd"
      d="M5.75 3H13V13H5.75V3ZM4.75 2H5.75H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H5.75H4.75H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H4.75ZM4.75 13H3L3 3H4.75V13Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const DoubleSideDoubleColumnOutlined = (props: LucideProps) => (
  <svg fill="none" height="16" viewBox="0 0 16 16" width="16" {...props}>
    <path
      clipRule="evenodd"
      d="M10.25 3H5.75V13H10.25V3ZM10.25 2H5.75H4.75H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H4.75H5.75H10.25H11.25H13C13.5523 14 14 13.5523 14 13V3C14 2.44772 13.5523 2 13 2H11.25H10.25ZM11.25 3V13H13V3H11.25ZM3 13H4.75V3H3L3 13Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);
