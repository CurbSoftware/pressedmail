'use client';

import * as React from 'react';
import { RadicalIcon } from 'lucide-react';
import type { TElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

type ComposerEquationElement = TElement & {
  texExpression?: string;
};

function getEquationText(element: ComposerEquationElement) {
  return element.texExpression?.trim() || __('Equation', 'pressedmail');
}

/**
 * Lightweight equation compatibility renderer.
 *
 * The full KaTeX editor is an optional Plate feature and is not imported by
 * the default PressedMail composer bundle. Existing saved equation nodes remain
 * visible as their LaTeX source.
 */
export function EquationElement(
  props: PlateElementProps<ComposerEquationElement>,
) {
  return (
    <PlateElement className="my-1" {...props}>
      <div
        className={cn(
          'my-2 flex select-none items-center justify-center rounded-sm border border-dashed border-muted-foreground/30 px-3 py-2 text-sm',
          props.element.texExpression
            ? 'font-mono text-foreground'
            : 'text-muted-foreground',
        )}
        contentEditable={false}
      >
        <RadicalIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {getEquationText(props.element)}
        </span>
      </div>
      {props.children}
    </PlateElement>
  );
}

export function InlineEquationElement(
  props: PlateElementProps<ComposerEquationElement>,
) {
  return (
    <PlateElement
      {...props}
      as="span"
      className="mx-1 inline-flex max-w-full select-none items-center rounded-sm bg-muted px-1.5 py-0.5 align-baseline font-mono text-xs"
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {getEquationText(props.element)}
      </span>
      {props.children}
    </PlateElement>
  );
}
