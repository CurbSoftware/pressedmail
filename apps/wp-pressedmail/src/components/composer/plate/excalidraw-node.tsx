'use client';

import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

type DrawingElement = {
  png?: string;
};

/**
 * Lightweight drawing compatibility renderer.
 *
 * The full Excalidraw canvas is an optional Plate feature and is not imported
 * by the default PressedMail composer bundle. Existing saved snapshots remain
 * visible; drawing authoring can be reintroduced as a selectable package kit.
 */
export function ExcalidrawElement(props: PlateElementProps) {
  const png = (props.element as DrawingElement).png;

  return (
    <PlateElement {...props}>
      <div
        className="my-2 flex min-h-24 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-sm text-muted-foreground"
        contentEditable={false}
      >
        {png ? (
          <img
            alt={__('Drawing', 'pressedmail')}
            className="h-auto max-w-full"
            src={png}
          />
        ) : (
          <span>{__('Drawing', 'pressedmail')}</span>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
