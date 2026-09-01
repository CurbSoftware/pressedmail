"use client";

import { getDateDisplayLabel } from "@kit/plate/date";
import type { TDateElement } from "@kit/plate";
import type { PlateElementProps } from "@kit/plate/react";
import { PlateElement, useReadOnly } from "@kit/plate/react";
import { useId } from "react";

import { DateTimeSelector } from "@/components/ui/date-time-selector";
import { cn } from "@/lib/utils";

/**
 * Inline date chip. Click opens the shared plugin date selector; the canonical
 * YYYY-MM-DD value is stored on `element.date` and rendered via getDateDisplayLabel.
 * Email serialization uses date-node-static.tsx (plain inline text).
 */
export function DateElement(props: PlateElementProps<TDateElement>) {
  const { editor, element } = props;
  const readOnly = useReadOnly();
  const selectorId = useId();

  const label =
    element.date || element.rawDate
      ? getDateDisplayLabel(element)
      : "Pick a date";

  const trigger = (
    <span
      className={cn(
        "w-fit cursor-pointer rounded-sm bg-muted px-1 text-muted-foreground",
      )}
      contentEditable={false}
      draggable>
      {label}
    </span>
  );

  return (
    <PlateElement
      {...props}
      attributes={{ ...props.attributes, contentEditable: false }}
      className="inline-block">
      {readOnly ? (
        trigger
      ) : (
        <DateTimeSelector
          id={selectorId}
          mode="date"
          value={element.date ?? ""}
          onChange={(nextDate) => {
            editor.tf.setNodes(
              { date: nextDate, rawDate: undefined } as never,
              { at: element },
            );
          }}
          data-test="plate-date-selector"
          data-testid="plate-date-selector"
          className={cn(
            "h-auto w-fit gap-1 rounded-sm border-0 bg-muted px-1 py-0 text-muted-foreground shadow-none hover:bg-muted",
          )}
        />
      )}
      {props.children}
    </PlateElement>
  );
}
