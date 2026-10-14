'use client';

/**
 * The Insert button block in the editor: the button as it is sent, a table
 * with one coloured cell, and a popover with its form. The live DOM carries the
 * same markup the static serializer writes, with everything else marked as
 * editor chrome, so the DOM fallback in `getComposerDomHtml` sends the same
 * thing. Free and Pro share it.
 */

import * as React from 'react';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement, useReadOnly, useSelected } from '@kit/plate/react';
import { Popover, PopoverAnchor } from '@kit/ui/plugin';
import { __ } from '@wordpress/i18n';

import { ButtonForm } from '@/components/composer/plate/button-form';
import { takeFreshButton } from '@/components/composer/plate/button-insert';
import { PressedPopoverContent } from '@/components/ui/pressed-overlay';
import { cn } from '@/lib/utils';

import { ButtonTableBody, buttonTableAttributes } from './button-table';
import type { TButtonElement } from './button-plugin';

const CHROME = { 'data-pm-editor-chrome': '' } as const;

export function ButtonElement(props: PlateElementProps<TButtonElement>) {
  const { editor, element } = props;
  const readOnly = useReadOnly();
  const selected = useSelected();
  const [open, setOpen] = React.useState(false);

  // A button a person has just inserted opens its form; one that arrives with
  // a draft does not. The editor hands over its "just inserted" note once, so a
  // later pass through here finds nothing.
  React.useEffect(() => {
    if (!readOnly && !element.url && takeFreshButton(editor)) setOpen(true);
  }, [editor, element.url, readOnly]);

  const { cellpadding, cellspacing, border, style, ...table } = buttonTableAttributes(element);

  return (
    <PlateElement
      {...props}
      attributes={{ ...props.attributes, contentEditable: false }}
      className="my-2">
      <Popover open={open && !readOnly} onOpenChange={setOpen} modal={false}>
        <div className="flex items-center gap-2">
          <PopoverAnchor asChild>
            <table
              {...table}
              cellPadding={cellpadding}
              cellSpacing={cellspacing}
              border={Number(border)}
              style={style}
              className={cn(
                !readOnly && 'cursor-pointer',
                selected && 'ring-2 ring-ring ring-offset-2',
              )}
              onClick={(event) => {
                // Never follow the link from inside the editor.
                event.preventDefault();
                if (!readOnly) setOpen(true);
              }}>
              <ButtonTableBody element={element} />
            </table>
          </PopoverAnchor>
          {/* A plain button, not a PopoverTrigger. Radix anchors to the trigger
              until it sees the PopoverAnchor, then remounts the trigger, so the
              popover kept measuring a detached button and opened at the
              top-left of the screen. The other composer popovers (media, table,
              column) open from an anchor alone in the same way. */}
          {!readOnly ? (
            <button
              type="button"
              {...CHROME}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {__('Edit button', 'pressedmail')}
            </button>
          ) : null}
        </div>
        <PressedPopoverContent
          size="paletteForm"
          align="start"
          aria-label={__('Edit button', 'pressedmail')}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.tf.focus();
          }}>
          <ButtonForm
            editor={editor}
            initial={element}
            onSubmit={(next) => {
              const at = editor.api.findPath(element);
              if (at) editor.tf.setNodes(next as never, { at });
              setOpen(false);
            }}
          />
        </PressedPopoverContent>
      </Popover>
      {props.children}
    </PlateElement>
  );
}
