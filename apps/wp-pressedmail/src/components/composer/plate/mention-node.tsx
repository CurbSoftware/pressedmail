'use client';

import * as React from 'react';
import { getMentionOnSelectItem } from '@kit/plate/mention';
import type { TComboboxInputElement, TMentionElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import {
  PlateElement,
  useFocused,
  useReadOnly,
  useSelected,
} from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

import {
  useContactSearch,
  type ContactSearchResult,
} from '@/hooks/useContactSearch';
import { cn } from '@/lib/utils';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from './ui/inline-combobox';

/** Committed mention chip. Email serialization renders plain `@name` text. */
export function MentionElement(
  props: PlateElementProps<TMentionElement> & { prefix?: string },
) {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const readOnly = useReadOnly();

  return (
    <PlateElement
      {...props}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
        draggable: true,
      }}
      className={cn(
        'inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium',
        !readOnly && 'cursor-pointer',
        selected && focused && 'ring-2 ring-ring',
      )}
    >
      {props.prefix}
      {element.value}
      {props.children}
    </PlateElement>
  );
}

const onSelectItem = getMentionOnSelectItem();

function contactLabel(c: ContactSearchResult): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email;
}

/** `@`-triggered combobox wired to PressedMail's contact search REST endpoint. */
export function MentionInputElement(
  props: PlateElementProps<TComboboxInputElement>,
) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');
  const { setQuery, results } = useContactSearch();

  React.useEffect(() => {
    setQuery(search);
  }, [search, setQuery]);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
        value={search}
      >
        <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring">
          <InlineComboboxInput />
        </span>

        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>
            {__('No contacts', 'pressedmail')}
          </InlineComboboxEmpty>

          <InlineComboboxGroup>
            {results.map((c) => {
              const text = contactLabel(c);
              return (
                <InlineComboboxItem
                  key={String(c.id)}
                  onClick={() =>
                    onSelectItem(editor, { key: String(c.id), text }, search)
                  }
                  value={text}
                >
                  {text}
                </InlineComboboxItem>
              );
            })}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
