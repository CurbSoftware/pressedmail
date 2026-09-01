'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import {
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isEqual,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { enUS, type Locale } from 'date-fns/locale';
import { CalendarIcon, CheckIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '../shadcn/button';
import { Calendar } from '../shadcn/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { DateTimeInput } from '../shadcn/date-input';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface DateTimeRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateTimeRangePreset {
  name: string;
  label: string;
}

export interface DateTimeRangePickerProps {
  /** Unique identifier: required when rendering multiple pickers on the same page. */
  id?: string;
  /** Controlled value. */
  value?: DateTimeRange;
  /** Called when the user clicks "Update". */
  onUpdate?: (range: DateTimeRange) => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  locale?: Locale;
  className?: string;
  triggerClassName?: string;
  /** Custom presets. If omitted, default presets are shown. Pass `[]` to hide presets. */
  presets?: DateTimeRangePreset[];
}

/* -------------------------------------------------------------------------- */
/*  Default presets                                                           */
/* -------------------------------------------------------------------------- */

const DEFAULT_PRESETS: DateTimeRangePreset[] = [
  { name: 'last7', label: 'Last 7 days' },
  { name: 'last14', label: 'Last 14 days' },
  { name: 'last30', label: 'Last 30 days' },
  { name: 'thisWeek', label: 'This Week' },
  { name: 'lastWeek', label: 'Last Week' },
  { name: 'thisMonth', label: 'This Month' },
  { name: 'lastMonth', label: 'Last Month' },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDateTime(date: Date | undefined, locale: Locale = enUS): string {
  if (!date || !isValid(date)) return 'Select date';
  return format(date, 'PPP p', { locale });
}

function getPresetRange(presetName: string): DateTimeRange {
  const now = new Date();
  const today = startOfDay(now);
  const endToday = endOfDay(now);

  switch (presetName) {
    case 'today':
      return { from: today, to: endToday };
    case 'yesterday': {
      const yesterday = subDays(today, 1);
      return { from: yesterday, to: endOfDay(yesterday) };
    }
    case 'last7':
      return { from: subDays(today, 6), to: endToday };
    case 'last14':
      return { from: subDays(today, 13), to: endToday };
    case 'last30':
      return { from: subDays(today, 29), to: endToday };
    case 'thisWeek':
      return { from: startOfWeek(today, { weekStartsOn: 0 }), to: endToday };
    case 'lastWeek': {
      const ws = startOfWeek(subDays(today, 7), { weekStartsOn: 0 });
      return { from: ws, to: endOfWeek(ws, { weekStartsOn: 0 }) };
    }
    case 'thisMonth':
      return { from: startOfMonth(today), to: endToday };
    case 'lastMonth': {
      const lm = subMonths(today, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    // Future-facing presets for OOO-style use cases
    case 'next1': {
      return { from: now, to: endOfDay(now) };
    }
    case 'next4': {
      const end = new Date(now.getTime() + 4 * 86400000);
      return { from: now, to: endOfDay(end) };
    }
    case 'next7': {
      const end = new Date(now.getTime() + 7 * 86400000);
      return { from: now, to: endOfDay(end) };
    }
    case 'next14': {
      const end = new Date(now.getTime() + 14 * 86400000);
      return { from: now, to: endOfDay(end) };
    }
    case 'next30': {
      const end = new Date(now.getTime() + 30 * 86400000);
      return { from: now, to: endOfDay(end) };
    }
    default:
      return { from: now, to: endToday };
  }
}

/** Merge date from `dateSource` with time from `timeSource` (falls back to midnight). */
function mergeDateTime(dateSource: Date, timeSource: Date | undefined): Date {
  const result = new Date(dateSource);
  if (timeSource) {
    result.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const DateTimeRangePicker: React.FC<DateTimeRangePickerProps> = ({
  id: externalId,
  value,
  onUpdate,
  disabled = false,
  align = 'start',
  locale = enUS,
  className,
  triggerClassName,
  presets,
}) => {
  const autoId = React.useId();
  const pickerId = externalId ?? autoId;
  const resolvedPresets = presets ?? DEFAULT_PRESETS;

  const [isOpen, setIsOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateTimeRange>({
    from: value?.from,
    to: value?.to,
  });
  const [selectedPreset, setSelectedPreset] = React.useState<
    string | undefined
  >(undefined);
  const [calendarMonths, setCalendarMonths] = React.useState<[Date, Date]>([
    value?.from ?? new Date(),
    addMonths(value?.from ?? new Date(), 1),
  ]);

  // Refs for stale-closure safety
  const openedRangeRef = React.useRef<DateTimeRange>(range);
  const rangeRef = React.useRef(range);

  React.useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  // Sync from controlled prop, compare by timestamp to avoid infinite loops
  React.useEffect(() => {
    const fromMs = value?.from?.getTime();
    const toMs = value?.to?.getTime();
    setRange((prev) => {
      if (prev.from?.getTime() === fromMs && prev.to?.getTime() === toMs) {
        return prev;
      }
      return {
        from: value?.from ? new Date(value.from) : undefined,
        to: value?.to ? new Date(value.to) : undefined,
      };
    });
  }, [value]);

  // Capture snapshot only when popover opens. Cancel restores to this
  React.useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = { ...rangeRef.current };
    }
  }, [isOpen]);

  // Check if the current range matches a preset
  const checkPreset = React.useCallback(() => {
    if (!range.from || !range.to) return;
    for (const preset of resolvedPresets) {
      const pr = getPresetRange(preset.name);
      if (
        pr.from &&
        pr.to &&
        isEqual(startOfDay(range.from), startOfDay(pr.from)) &&
        isEqual(endOfDay(range.to), endOfDay(pr.to))
      ) {
        setSelectedPreset(preset.name);
        return;
      }
    }
    setSelectedPreset(undefined);
  }, [range, resolvedPresets]);

  React.useEffect(() => {
    checkPreset();
  }, [checkPreset]);

  const applyPreset = (preset: string) => {
    const newRange = getPresetRange(preset);
    setRange(newRange);
    setSelectedPreset(preset);
    if (newRange.from) {
      setCalendarMonths([newRange.from, addMonths(newRange.from, 1)]);
    }
  };

  const handleCalendarSelect = (
    newRange: { from?: Date; to?: Date } | undefined,
  ) => {
    if (!newRange) return;
    setRange((prev) => ({
      from: newRange.from ? mergeDateTime(newRange.from, prev.from) : undefined,
      to: newRange.to ? mergeDateTime(newRange.to, prev.to) : undefined,
    }));
  };

  const handleFromChange = (date: Date | undefined) => {
    if (date) setRange((prev) => ({ ...prev, from: date }));
  };

  const handleToChange = (date: Date | undefined) => {
    if (date) setRange((prev) => ({ ...prev, to: date }));
  };

  const handleUpdate = () => {
    setIsOpen(false);
    const opened = openedRangeRef.current;
    const changed =
      range.from?.getTime() !== opened.from?.getTime() ||
      range.to?.getTime() !== opened.to?.getTime();
    if (changed) {
      onUpdate?.(range);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setRange(openedRangeRef.current);
  };

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id={`dtrp-trigger-${pickerId}`}
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left text-[11px] font-normal',
              triggerClassName,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">
              {formatDateTime(range.from, locale)}
            </span>
            {range.to && (
              <>
                <ChevronRightIcon className="mx-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {formatDateTime(range.to, locale)}
                </span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align} sideOffset={4}>
          <div className="flex flex-col gap-4 p-4">
            {/* Calendar */}
            <div className="flex justify-center gap-4">
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleCalendarSelect}
                month={calendarMonths[0]}
                onMonthChange={(month) =>
                  setCalendarMonths([month, addMonths(month, 1)])
                }
                className="border rounded-md"
              />
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleCalendarSelect}
                month={calendarMonths[1]}
                onMonthChange={(month) =>
                  setCalendarMonths([subMonths(month, 1), month])
                }
                className="border rounded-md"
              />
            </div>

            {/* Start / End DateTime inputs */}
            <div className="flex items-center gap-2">
              <DateTimeInput
                value={range.from}
                onChange={handleFromChange}
                label="Start"
                className="flex-1"
              />
              <ChevronRightIcon className="mt-6 h-4 w-4 shrink-0 text-muted-foreground" />
              <DateTimeInput
                value={range.to}
                onChange={handleToChange}
                label="End"
                className="flex-1"
              />
            </div>

            {/* Presets */}
            {resolvedPresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 border-t pt-3">
                <span className="mr-1 text-sm font-medium text-popover-foreground">
                  Presets
                </span>
                {resolvedPresets.map((preset) => {
                  const isSelected = selectedPreset === preset.name;
                  return (
                    <Button
                      key={preset.name}
                      variant={isSelected ? 'default' : 'ghost'}
                      size="sm"
                      className="justify-start"
                      onClick={() => applyPreset(preset.name)}
                    >
                      <CheckIcon
                        className={cn(
                          'mr-1.5 h-3.5 w-3.5',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t p-3">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpdate}>
              Update
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

DateTimeRangePicker.displayName = 'DateTimeRangePicker';

export { DateTimeRangePicker };
