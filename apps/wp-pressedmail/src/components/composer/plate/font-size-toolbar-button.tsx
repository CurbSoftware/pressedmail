'use client';

/**
 * Font size stepper (template font-size-toolbar-button.tsx port): minus /
 * editable value / plus, with a quick-pick popover while the input is
 * focused. The highlighted row uses a conditional class instead of the
 * template's `data-[highlighted=true]:` arbitrary variant (not emitted by
 * this app's Tailwind build).
 */

import * as React from 'react';
import { toUnitLess } from '@kit/plate/basic-styles';
import { FontSizePlugin } from '@kit/plate/basic-styles/react';
import { Minus, Plus } from 'lucide-react';
import type { TElement } from '@kit/plate';
import { KEYS } from '@kit/plate';
import { useEditorPlugin, useEditorSelector } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import { Popover, PopoverTrigger } from "@kit/ui/plugin";
import {
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";

import { cn } from '@/lib/utils';
import {
  FONT_SIZE_GROUP_CLASS,
  FONT_SIZE_INPUT_CLASS,
  FONT_SIZE_STEP_BUTTON_CLASS,
} from '@/components/composer/toolbar';

// Unmarked body text renders at the composer's base size, which the caller
// passes from the "Composer default font size" preference.
const DEFAULT_FONT_SIZE = '14';
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 300;

const FONT_SIZE_MAP: Record<string, string> = {
  h1: '36',
  h2: '24',
  h3: '20',
};

const FONT_SIZES = [
  '8',
  '9',
  '10',
  '12',
  '14',
  '16',
  '18',
  '24',
  '30',
  '36',
  '48',
  '60',
  '72',
  '96',
] as const;

export function FontSizeToolbarButton({
  defaultFontSize = DEFAULT_FONT_SIZE,
}: {
  /** Size unmarked paragraphs render at, so the readout matches the body. */
  defaultFontSize?: string;
} = {}) {
  const [inputValue, setInputValue] = React.useState(defaultFontSize);
  const [isFocused, setIsFocused] = React.useState(false);
  const { editor, tf } = useEditorPlugin(FontSizePlugin);

  const cursorFontSize = useEditorSelector((editor) => {
    const fontSize = editor.api.marks()?.[KEYS.fontSize];

    if (fontSize) {
      return toUnitLess(fontSize as string);
    }

    const [block] = editor.api.block<TElement>() || [];

    if (!block?.type) return defaultFontSize;

    return FONT_SIZE_MAP[block.type] ?? defaultFontSize;
  }, [defaultFontSize]);

  const displayValue = isFocused ? inputValue : cursorFontSize;

  const clampFontSize = (value: string | number) => {
    const numeric = Number.parseInt(toUnitLess(String(value)), 10);

    if (Number.isNaN(numeric)) {
      return Number.parseInt(toUnitLess(cursorFontSize), 10);
    }

    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, numeric));
  };

  const applyFontSize = (size: string) => {
    // Apply the fontSize mark to the current selection. Fall back to a direct
    // addMarks if the plugin transform namespace isn't present.
    if (tf.fontSize?.addMark) {
      tf.fontSize.addMark(size);
    } else {
      editor.tf.addMarks({ [KEYS.fontSize]: size });
    }
  };

  const commitFontSize = () => {
    const newSize = String(clampFontSize(inputValue));

    if (newSize !== toUnitLess(cursorFontSize)) {
      applyFontSize(`${newSize}px`);
    }

    editor.tf.focus();
  };

  const handleFontSizeChange = (delta: number) => {
    const newSize = clampFontSize(Number(displayValue) + delta);
    applyFontSize(`${newSize}px`);
    editor.tf.focus();
  };

  return (
    <div className={FONT_SIZE_GROUP_CLASS} data-test="composer-font-size-control">
      <button
        type="button"
        className={FONT_SIZE_STEP_BUTTON_CLASS}
        data-plate-prevent-deselect
        onClick={() => handleFontSizeChange(-1)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={__('Decrease font size', 'pressedmail')}
      >
        <Minus className="size-4" />
      </button>

      <Popover modal={false} open={isFocused}>
        <PopoverTrigger asChild>
          <input autoComplete="off"
            aria-label={__('Font size', 'pressedmail')}
            className={FONT_SIZE_INPUT_CLASS}
            data-plate-focus="true"
            onBlur={() => {
              setIsFocused(false);
              commitFontSize();
            }}
            onChange={(e) =>
              setInputValue(e.target.value.replace(/[^\d]/g, ''))
            }
            onFocus={() => {
              setIsFocused(true);
              setInputValue(toUnitLess(cursorFontSize));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitFontSize();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setInputValue(toUnitLess(cursorFontSize));
                setIsFocused(false);
                editor.tf.focus();
              }
            }}
            type="text"
            value={displayValue}
          />
        </PopoverTrigger>
        <PressedPopoverContent
          size="menu"
          className="w-10 px-px py-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {FONT_SIZES.map((size) => (
            <button
              className={cn(
                'flex h-8 w-full items-center justify-center text-sm hover:bg-accent',
                size === displayValue && 'bg-accent',
              )}
              data-plate-prevent-deselect
              key={size}
              onClick={() => {
                // Mirror the +/- stepper path: apply the mark, reflect the
                // chosen size in the input, then refocus the editor so the
                // cursorFontSize selector re-reads the new mark. Without the
                // refocus the dropdown applied the size but the input kept the
                // old value and the selection wasn't restored.
                applyFontSize(`${size}px`);
                setInputValue(size);
                setIsFocused(false);
                editor.tf.focus();
              }}
              onMouseDown={(e) => e.preventDefault()}
              type="button"
            >
              {size}
            </button>
          ))}
        </PressedPopoverContent>
      </Popover>

      <button
        type="button"
        className={FONT_SIZE_STEP_BUTTON_CLASS}
        data-plate-prevent-deselect
        onClick={() => handleFontSizeChange(1)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={__('Increase font size', 'pressedmail')}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
