'use client';

/**
 * The Insert button form: text, link, colours and width. It is the editing surface of the button
 * block (nodes/button-node.tsx) and nothing else; the toolbar and the slash menu
 * only drop a button in, and its form opens on it.
 */

import * as React from 'react';
import { BaseLinkPlugin, validateUrl } from '@kit/plate/link';
import { LinkPlugin } from '@kit/plate/link/react';
import type { PlateEditor } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { Button, Input, Label } from '@kit/ui/plugin';
import { ColorSwatchPopover } from '@/components/ui/color-picker/ColorSwatchPopover';
import { PalettePicker } from '@/components/ui/color-picker/PalettePicker';
import { isHexColor } from '@/lib/hex-color';
import { isTemplateToken } from '@/lib/merge-fields';
import {
  BUTTON_LABEL_MAX,
  cleanButtonLabel,
  cleanButtonUrl,
  normalizeButton,
  type ButtonSettings,
  type ButtonWidth,
} from '../nodes/button-fields';

/**
 * The address as the link box would keep it, or null when the box would refuse
 * it. A merge field is a valid address only on the surfaces whose link box takes
 * one, and that box takes it only while it is open, so ask the same way.
 */
export function resolveButtonAddress(editor: PlateEditor, typed: string): string | null {
  const { transformInput } = editor.getOptions(BaseLinkPlugin);
  const candidate = (transformInput ? transformInput(typed) : typed)?.trim() ?? '';
  if (!candidate) return null;
  // An editor that does not take merge fields wraps one in https:// like any
  // other text, and the address would reach the recipient with its braces. So a
  // field counts only when it came through untouched, as the whole address.
  if (/\{\{|\}\}/.test(candidate) && !(isTemplateToken(candidate) && candidate === typed.trim())) return null;
  const mode = editor.getOption(LinkPlugin, 'mode');
  editor.setOption(LinkPlugin, 'mode', 'insert');
  try {
    return validateUrl(editor, candidate) ? cleanButtonUrl(candidate) || null : null;
  } finally {
    editor.setOption(LinkPlugin, 'mode', mode);
  }
}

function ColorField({
  id,
  label,
  swatchLabel,
  value,
  onChange,
}: {
  id: string;
  label: string;
  swatchLabel: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = React.useState(value);
  const invalid = !isHexColor(text);
  // The swatch keeps showing the last color that was a color while the field is mid-edit.
  const shown = React.useRef(value);
  if (!invalid) shown.current = text;
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <ColorSwatchPopover
          value={shown.current}
          label={swatchLabel}
          className="h-7 w-7 shrink-0 rounded border !bg-none pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <PalettePicker
            value={shown.current}
            layout="background"
            onChange={(hex) => {
              // Buttons take opaque colors: the picker's alpha is dropped.
              const opaque = hex.slice(0, 7);
              setText(opaque);
              onChange(opaque);
            }}
          />
        </ColorSwatchPopover>
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className="w-28 font-mono text-sm"
          onChange={(event) => {
            // The form gets what was typed, valid or not, so it can refuse to save a color it cannot use.
            const next = event.target.value.trim();
            setText(next);
            onChange(next);
          }}
        />
      </div>
      {invalid ? (
        <p id={errorId} className="text-xs text-destructive">
          {__('Use a hex color such as #2563eb.', 'pressedmail')}
        </p>
      ) : null}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium leading-none">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ButtonForm({
  editor,
  initial,
  onSubmit,
}: {
  editor: PlateEditor;
  initial: ButtonSettings;
  onSubmit: (next: ButtonSettings) => void;
}) {
  const ids = React.useId();
  const [form, setForm] = React.useState<ButtonSettings>(initial);
  const [labelMissing, setLabelMissing] = React.useState(false);
  const [urlRefused, setUrlRefused] = React.useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // The form renders in a portal, but React bubbles its submit up the
    // component tree: inside the signature editor's form it saved and closed
    // the whole signature. A button's form answers for itself only.
    event.stopPropagation();
    const label = cleanButtonLabel(form.label);
    const url = resolveButtonAddress(editor, form.url);
    setLabelMissing(!label);
    setUrlRefused(!url);
    if (!label || !url || !isHexColor(form.buttonColor) || !isHexColor(form.textColor)) return;
    onSubmit(normalizeButton({ ...form, label, url }));
  };

  return (
    <form className="flex flex-col gap-3 p-3" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-label`} className="text-sm font-medium">
          {__('Button text', 'pressedmail')}
        </Label>
        <Input
          id={`${ids}-label`}
          autoComplete="off"
          maxLength={BUTTON_LABEL_MAX}
          value={form.label}
          aria-invalid={labelMissing || undefined}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
        />
        {labelMissing ? (
          <p className="text-xs text-destructive">{__('Enter the button text.', 'pressedmail')}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-url`} className="text-sm font-medium">
          {__('Link', 'pressedmail')}
        </Label>
        <Input
          id={`${ids}-url`}
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={form.url}
          aria-invalid={urlRefused || undefined}
          onChange={(event) => setForm({ ...form, url: event.target.value })}
        />
        {urlRefused ? (
          <p className="text-xs text-destructive">
            {__('Use a link that starts with https://, http://, mailto: or tel:', 'pressedmail')}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <ColorField
          id={`${ids}-bg`}
          label={__('Background', 'pressedmail')}
          swatchLabel={__('Choose a background color', 'pressedmail')}
          value={form.buttonColor}
          onChange={(buttonColor) => setForm({ ...form, buttonColor })}
        />
        <ColorField
          id={`${ids}-fg`}
          label={__('Text color', 'pressedmail')}
          swatchLabel={__('Choose a text color', 'pressedmail')}
          value={form.textColor}
          onChange={(textColor) => setForm({ ...form, textColor })}
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Choice<ButtonWidth>
          label={__('Width', 'pressedmail')}
          value={form.width}
          options={[
            { value: 'fit', label: __('Fit to text', 'pressedmail') },
            { value: 'full', label: __('Full width', 'pressedmail') },
          ]}
          onChange={(width) => setForm({ ...form, width })}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {__('Update button', 'pressedmail')}
        </Button>
      </div>
    </form>
  );
}
