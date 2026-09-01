"use client";

import { useEffect, useMemo, useState } from "react";
import { __ } from "@wordpress/i18n";
import { CalendarIcon, Check, Clock } from "lucide-react";

import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";

export type DateTimeSelectorMode = "date" | "time" | "datetime";
export type DateTimeSelectorTimeDisplayMode = "12h" | "24h";

export interface DateTimeSelectorProps {
  id: string;
  mode: DateTimeSelectorMode;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;
  minuteStep?: number;
  defaultTime?: string;
  timeDisplayMode?: DateTimeSelectorTimeDisplayMode;
  showTimeModeSelector?: boolean;
  /**
   * Both spellings are accepted and render together. Playwright resolves the
   * plugin suite against `data-test` while the unit tests query `data-testid`,
   * and this component reads the prop rather than spreading it, so a caller
   * that passed only one would have had it silently dropped.
   */
  "data-test"?: string;
  "data-testid"?: string;
  "aria-invalid"?: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clampMinuteStep(step?: number): number {
  if (!step || !Number.isFinite(step) || step < 1 || step > 60) return 1;
  return Math.floor(step);
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, hours, minutes] = match;
  const parsed = {
    hours: Number(hours),
    minutes: Number(minutes),
  };
  if (
    parsed.hours < 0 ||
    parsed.hours > 23 ||
    parsed.minutes < 0 ||
    parsed.minutes > 59
  ) {
    return null;
  }
  return parsed;
}

function getTimeSource(value: string, mode: DateTimeSelectorMode): string {
  if (mode === "datetime") return value.split("T")[1] ?? "";
  if (mode === "time") return value;
  return "";
}

function parseSelectorDate(
  value: string,
  mode: DateTimeSelectorMode,
  defaultTime?: string,
): Date {
  const now = new Date();
  const date =
    mode === "time"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : (parseLocalDate(value) ?? now);
  const time =
    parseTime(getTimeSource(value, mode)) ??
    (mode === "date" ? null : parseTime(defaultTime ?? ""));

  if (time) {
    date.setHours(time.hours, time.minutes, 0, 0);
  } else if (mode === "date") {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatValue(date: Date, mode: DateTimeSelectorMode): string {
  if (mode === "date") return formatDate(date);
  if (mode === "time") return formatTime(date);
  return `${formatDate(date)}T${formatTime(date)}`;
}

function getHour12(hours: number): number {
  const hour = hours % 12;
  return hour === 0 ? 12 : hour;
}

function formatDisplayValue(
  value: string,
  mode: DateTimeSelectorMode,
  timeDisplayMode: DateTimeSelectorTimeDisplayMode,
): string {
  if (!value) {
    if (mode === "time") return __("Select time", "pressedmail");
    if (mode === "date") return __("Select date", "pressedmail");
    return __("Select date and time", "pressedmail");
  }

  const parsed = parseSelectorDate(value, mode);
  if (mode === "date") return formatDate(parsed);
  if (timeDisplayMode === "24h") {
    const time = formatTime(parsed);
    return mode === "time" ? time : `${formatDate(parsed)} ${time}`;
  }

  const time = `${pad(getHour12(parsed.getHours()))}:${pad(
    parsed.getMinutes(),
  )} ${parsed.getHours() >= 12 ? "PM" : "AM"}`;
  return mode === "time" ? time : `${formatDate(parsed)} ${time}`;
}

function toComparableDate(value: string | undefined): string | null {
  return value ? formatDate(parseLocalDate(value) ?? new Date(value)) : null;
}

function isDateDisabled(date: Date, min?: string, max?: string): boolean {
  const current = formatDate(date);
  const minDate = toComparableDate(min);
  const maxDate = toComparableDate(max);
  if (minDate && current < minDate) return true;
  if (maxDate && current > maxDate) return true;
  return false;
}

interface TimeControlsProps {
  date: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  minuteStep: number;
  timeDisplayMode: DateTimeSelectorTimeDisplayMode;
  onTimeDisplayModeChange: (mode: DateTimeSelectorTimeDisplayMode) => void;
  showTimeModeSelector: boolean;
  testId?: string;
}

function TimeControls({
  date,
  onChange,
  disabled,
  minuteStep,
  timeDisplayMode,
  onTimeDisplayModeChange,
  showTimeModeSelector,
  testId,
}: TimeControlsProps) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hourValue =
    timeDisplayMode === "24h" ? pad(hours) : pad(getHour12(hours));
  const minuteValue = pad(minutes);
  const modeValue = timeDisplayMode === "24h" ? "24" : meridiem;
  const minuteOptions = useMemo(() => {
    const options: string[] = [];
    for (let minute = 0; minute < 60; minute += minuteStep) {
      options.push(pad(minute));
    }
    if (!options.includes(minuteValue)) options.push(minuteValue);
    return options.sort();
  }, [minuteStep, minuteValue]);
  const hourOptions =
    timeDisplayMode === "24h"
      ? Array.from({ length: 24 }, (_, index) => pad(index))
      : Array.from({ length: 12 }, (_, index) => pad(index + 1));

  function commitTime(nextHours: number, nextMinutes = minutes) {
    const next = new Date(date);
    next.setHours(nextHours, nextMinutes, 0, 0);
    onChange(next);
  }

  function handleHourChange(nextHour: string) {
    const parsedHour = Number(nextHour);
    if (timeDisplayMode === "24h") {
      commitTime(parsedHour);
      return;
    }
    const nextHours =
      meridiem === "PM"
        ? parsedHour === 12
          ? 12
          : parsedHour + 12
        : parsedHour === 12
          ? 0
          : parsedHour;
    commitTime(nextHours);
  }

  function handleMinuteChange(nextMinute: string) {
    commitTime(hours, Number(nextMinute));
  }

  function handleMeridiemChange(nextMeridiem: "AM" | "PM") {
    if (nextMeridiem === meridiem) return;
    commitTime(nextMeridiem === "PM" ? hours + 12 : hours - 12);
  }

  function handleModeChange(nextMode: string) {
    if (nextMode === "24") {
      onTimeDisplayModeChange("24h");
      return;
    }

    onTimeDisplayModeChange("12h");
    handleMeridiemChange(nextMode as "AM" | "PM");
  }

  return (
    <div data-test={testId} data-testid={testId} className="text-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={hourValue}
          onValueChange={handleHourChange}
          disabled={disabled}>
          <SelectTrigger className="h-8 w-[4.5rem]">
            <SelectValue placeholder={__("HH", "pressedmail")} />
          </SelectTrigger>
          <SelectContent>
            {hourOptions.map((hour) => (
              <SelectItem
                key={hour}
                value={hour}
                data-test={`time-selector-hour-${hour}`}
                data-testid={`time-selector-hour-${hour}`}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm font-medium text-muted-foreground">:</span>
        <Select
          value={minuteValue}
          onValueChange={handleMinuteChange}
          disabled={disabled}>
          <SelectTrigger className="h-8 w-[4.5rem]">
            <SelectValue placeholder={__("MM", "pressedmail")} />
          </SelectTrigger>
          <SelectContent>
            {minuteOptions.map((minute) => (
              <SelectItem
                key={minute}
                value={minute}
                data-test={`time-selector-minute-${minute}`}
                data-testid={`time-selector-minute-${minute}`}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showTimeModeSelector && (
          <Select
            value={modeValue}
            onValueChange={handleModeChange}
            disabled={disabled}>
            <SelectTrigger
              className="h-8 w-[4.5rem]"
              data-test="time-selector-mode-trigger"
              data-testid="time-selector-mode-trigger">
              <SelectValue placeholder={__("Mode", "pressedmail")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="AM"
                data-test="time-selector-mode-AM"
                data-testid="time-selector-mode-AM">
                AM
              </SelectItem>
              <SelectItem
                value="PM"
                data-test="time-selector-mode-PM"
                data-testid="time-selector-mode-PM">
                PM
              </SelectItem>
              <SelectItem
                value="24"
                data-test="time-selector-mode-24"
                data-testid="time-selector-mode-24">
                24
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function DateTimeSelector({
  id,
  mode,
  value,
  onChange,
  disabled,
  required,
  min,
  max,
  className,
  minuteStep,
  defaultTime,
  timeDisplayMode = "12h",
  showTimeModeSelector = true,
  "data-test": dataTest,
  "data-testid": dataTestIdProp,
  "aria-invalid": ariaInvalid,
}: DateTimeSelectorProps) {
  const dataTestId = dataTest ?? dataTestIdProp;
  const [open, setOpen] = useState(false);
  const [activeTimeDisplayMode, setActiveTimeDisplayMode] =
    useState<DateTimeSelectorTimeDisplayMode>(timeDisplayMode);
  const selectedDate = useMemo(
    () => parseSelectorDate(value, mode, defaultTime),
    [defaultTime, mode, value],
  );
  const step = clampMinuteStep(minuteStep);
  const Icon = mode === "time" ? Clock : CalendarIcon;

  useEffect(() => {
    setActiveTimeDisplayMode(timeDisplayMode);
  }, [timeDisplayMode]);

  function commit(nextDate: Date, close = false) {
    onChange(formatValue(nextDate, mode));
    if (close) setOpen(false);
  }

  function handleDateChange(nextDate: Date | undefined) {
    if (!nextDate) return;
    const merged = new Date(nextDate);
    merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    commit(merged, mode === "date");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-required={required}
          data-test={dataTestId}
          data-testid={dataTestId}
          data-mode={mode}
          className={cn(
            "h-9 w-full justify-start gap-2 rounded-md border-input bg-background px-3 py-2 text-left text-sm font-normal text-foreground shadow-sm hover:bg-background",
            ariaInvalid && "border-destructive",
            className,
          )}>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {formatDisplayValue(value, mode, activeTimeDisplayMode)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        data-test={dataTestId ? `${dataTestId}-popover` : undefined}
        data-testid={dataTestId ? `${dataTestId}-popover` : undefined}
        className="w-auto max-w-[min(21rem,calc(100vw-2rem))] bg-popover p-2 text-popover-foreground">
        <div className="space-y-3">
          {mode !== "time" && (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateChange}
              disabled={(date) => isDateDisabled(date, min, max)}
              data-test={dataTestId ? `${dataTestId}-calendar` : undefined}
              data-testid={dataTestId ? `${dataTestId}-calendar` : undefined}
              className="!bg-transparent p-0"
            />
          )}
          {mode !== "date" && (
            <TimeControls
              date={selectedDate}
              onChange={(next) => commit(next)}
              disabled={disabled}
              minuteStep={step}
              timeDisplayMode={activeTimeDisplayMode}
              onTimeDisplayModeChange={setActiveTimeDisplayMode}
              showTimeModeSelector={showTimeModeSelector}
              testId={dataTestId ? `${dataTestId}-time-controls` : undefined}
            />
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              <Check className="mr-2 h-4 w-4" />
              {__("Done", "pressedmail")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateTimeSelector;
