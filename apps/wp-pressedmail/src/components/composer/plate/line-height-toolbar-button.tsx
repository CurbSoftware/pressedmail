'use client';

/**
 * Line height dropdown (template line-height-toolbar-button.tsx port).
 * Reads the valid values from LineHeightPlugin inject props; selection
 * state uses the plugin DropdownMenuRadioItem's built-in indicator instead
 * of the template's `*:first:[span]:hidden` arbitrary variants (not emitted
 * by this app's Tailwind build).
 */

import * as React from 'react';
import { LineHeightPlugin } from '@kit/plate/basic-styles/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import { WrapText } from 'lucide-react';
import { useEditorRef, useSelectionFragmentProp } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';

export function LineHeightToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const { defaultNodeValue, validNodeValues: values = [] } =
    editor.getInjectProps(LineHeightPlugin);

  const value = useSelectionFragmentProp({
    defaultValue: defaultNodeValue,
    getProp: (node) => node.lineHeight,
  });

  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}
          isDropdown
          pressed={open}
          tooltip={__('Line height', 'pressedmail')}
        >
          <WrapText />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuRadioGroup
          onValueChange={(newValue) => {
            editor
              .getTransforms(LineHeightPlugin)
              .lineHeight.setNodes(Number(newValue));
            editor.tf.focus();
          }}
          value={value === undefined ? undefined : String(value)}
        >
          {values.map((itemValue) => (
            <DropdownMenuRadioItem
              className="min-w-[140px]"
              key={String(itemValue)}
              value={String(itemValue)}
            >
              {String(itemValue)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
