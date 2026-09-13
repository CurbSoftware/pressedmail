'use client';

import * as React from 'react';
import { EmojiInlineIndexSearch, insertEmoji } from '@kit/plate/emoji';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { useEmojiData } from './emoji-data';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from './ui/inline-combobox';

const TRAILING_COLON_REGEX = /:$/;

/** Small local debounce (the template uses a shared use-debounce hook). */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** `:` inline emoji combobox (template emoji-node.tsx port). */
export function EmojiInputElement(props: PlateElementProps) {
  const { children, editor, element } = props;
  const data = useEmojiData();
  const [value, setValue] = React.useState('');
  const debouncedValue = useDebouncedValue(value, 100);
  const isPending = value !== debouncedValue;

  const filteredEmojis = React.useMemo(() => {
    if (!data || debouncedValue.trim().length === 0) return [];

    return EmojiInlineIndexSearch.getInstance(data)
      .search(debouncedValue.replace(TRAILING_COLON_REGEX, ''))
      .get();
  }, [data, debouncedValue]);

  return (
    <PlateElement as="span" {...props}>
      <InlineCombobox
        element={element}
        filter={false}
        hideWhenNoValue
        setValue={setValue}
        trigger=":"
        value={value}
      >
        <InlineComboboxInput />

        <InlineComboboxContent>
          {!isPending && (
            <InlineComboboxEmpty>
              {data
                ? __('No results', 'pressedmail')
                : __('Loading emoji...', 'pressedmail')}
            </InlineComboboxEmpty>
          )}

          <InlineComboboxGroup>
            {filteredEmojis.map((emoji) => (
              <InlineComboboxItem
                key={emoji.id}
                onClick={() => insertEmoji(editor, emoji)}
                value={emoji.name}
              >
                {emoji.skins[0]?.native} {emoji.name}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {children}
    </PlateElement>
  );
}
