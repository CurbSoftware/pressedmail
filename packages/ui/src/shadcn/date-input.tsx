'use client';

import * as React from 'react';

import { cn } from '#lib/utils';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { Button } from './button';

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  if (typeof window !== 'undefined' && window.innerWidth > 1024) {
    e.target.select();
  }
}

/* -------------------------------------------------------------------------- */
/*  DateInput                                                                 */
/* -------------------------------------------------------------------------- */

interface DateInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

interface DateParts {
  month: number;
  day: number;
  year: number;
}

function toParts(d: Date): DateParts {
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    year: d.getFullYear(),
  };
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [date, setDate] = React.useState<DateParts>(() =>
    toParts(value ? new Date(value) : new Date()),
  );

  // Keep a ref so event handlers always read latest state
  const dateRef = React.useRef(date);

  React.useEffect(() => {
    dateRef.current = date;
  }, [date]);

  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  // Sync from controlled prop
  React.useEffect(() => {
    if (value) {
      const parts = toParts(new Date(value));
      setDate(parts);
    }
  }, [value]);

  const validateDate = (
    current: DateParts,
    field: keyof DateParts,
    val: number,
  ): boolean => {
    if (field === 'month' && (val < 1 || val > 12)) return false;
    if (field === 'day' && (val < 1 || val > 31)) return false;
    if (field === 'year' && (val < 1000 || val > 9999)) return false;

    const newDate = { ...current, [field]: val };
    const d = new Date(newDate.year, newDate.month - 1, newDate.day);
    return (
      d.getFullYear() === newDate.year &&
      d.getMonth() + 1 === newDate.month &&
      d.getDate() === newDate.day
    );
  };

  const emitChange = (parts: DateParts) => {
    onChange?.(new Date(parts.year, parts.month - 1, parts.day));
  };

  const handleInputChange =
    (field: keyof DateParts) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;

      const raw = e.target.value.replace(/\D/g, '');
      if (!raw) return;

      const numValue = Number(raw);
      const current = dateRef.current;
      const newDate = { ...current, [field]: numValue };
      setDate(newDate);

      if (validateDate(current, field, numValue)) {
        emitChange(newDate);
      }

      // Auto-advance when segment is full
      const maxLen = field === 'year' ? 4 : 2;
      if (raw.length >= maxLen) {
        if (field === 'month') dayRef.current?.focus();
        if (field === 'day') yearRef.current?.focus();
      }
    };

  const snapshotRef = React.useRef<DateParts>(date);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    snapshotRef.current = { ...dateRef.current };
    selectOnFocus(e);
  };

  const handleBlur =
    (field: keyof DateParts) => (e: React.FocusEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (!e.target.value) {
        setDate(snapshotRef.current);
        return;
      }
      const numValue = Number(e.target.value);
      if (!validateDate(dateRef.current, field, numValue)) {
        setDate(snapshotRef.current);
      } else {
        snapshotRef.current = { ...dateRef.current };
      }
    };

  const handleKeyDown =
    (field: keyof DateParts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey) return;

      if (
        !/^[0-9]$/.test(e.key) &&
        ![
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Delete',
          'Tab',
          'Backspace',
          'Enter',
        ].includes(e.key)
      ) {
        if (e.key === '/' || e.key === '-') {
          e.preventDefault();
          if (field === 'month') dayRef.current?.focus();
          if (field === 'day') yearRef.current?.focus();
          return;
        }
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const current = dateRef.current;
        const newDate = { ...current };

        if (field === 'day') {
          const maxDay = new Date(current.year, current.month, 0).getDate();
          if (current.day >= maxDay) {
            newDate.day = 1;
            newDate.month = (current.month % 12) + 1;
            if (newDate.month === 1) newDate.year += 1;
          } else {
            newDate.day += 1;
          }
        } else if (field === 'month') {
          if (current.month === 12) {
            newDate.month = 1;
            newDate.year += 1;
          } else {
            newDate.month += 1;
          }
        } else if (field === 'year') {
          newDate.year += 1;
        }

        setDate(newDate);
        emitChange(newDate);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const current = dateRef.current;
        const newDate = { ...current };

        if (field === 'day') {
          if (current.day <= 1) {
            newDate.month -= 1;
            if (newDate.month === 0) {
              newDate.month = 12;
              newDate.year -= 1;
            }
            newDate.day = new Date(newDate.year, newDate.month, 0).getDate();
          } else {
            newDate.day -= 1;
          }
        } else if (field === 'month') {
          if (current.month === 1) {
            newDate.month = 12;
            newDate.year -= 1;
          } else {
            newDate.month -= 1;
          }
        } else if (field === 'year') {
          newDate.year -= 1;
        }

        setDate(newDate);
        emitChange(newDate);
      }

      if (e.key === 'ArrowRight') {
        const el = e.currentTarget;
        if (
          el.selectionStart === el.value.length ||
          (el.selectionStart === 0 && el.selectionEnd === el.value.length)
        ) {
          e.preventDefault();
          if (field === 'month') dayRef.current?.focus();
          if (field === 'day') yearRef.current?.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        const el = e.currentTarget;
        if (
          el.selectionStart === 0 ||
          (el.selectionStart === 0 && el.selectionEnd === el.value.length)
        ) {
          e.preventDefault();
          if (field === 'day') monthRef.current?.focus();
          if (field === 'year') dayRef.current?.focus();
        }
      }
    };

  const segmentClass =
    'bg-transparent p-0 outline-none border-none text-center text-sm h-full min-w-0';

  return (
    <div
      data-slot="date-input"
      className={cn('flex items-center px-1', className)}
    >
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={date.month.toString()}
        onChange={handleInputChange('month')}
        onKeyDown={handleKeyDown('month')}
        onFocus={handleFocus}
        onBlur={handleBlur('month')}
        className={cn(segmentClass, 'w-10')}
        placeholder="MM"
        disabled={disabled}
        aria-label="Month"
      />
      <span className="text-muted-foreground/40 select-none">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={date.day.toString()}
        onChange={handleInputChange('day')}
        onKeyDown={handleKeyDown('day')}
        onFocus={handleFocus}
        onBlur={handleBlur('day')}
        className={cn(segmentClass, 'w-10')}
        placeholder="DD"
        disabled={disabled}
        aria-label="Day"
      />
      <span className="text-muted-foreground/40 select-none">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={date.year.toString()}
        onChange={handleInputChange('year')}
        onKeyDown={handleKeyDown('year')}
        onFocus={handleFocus}
        onBlur={handleBlur('year')}
        className={cn(segmentClass, 'w-16')}
        placeholder="YYYY"
        disabled={disabled}
        aria-label="Year"
      />
    </div>
  );
};

DateInput.displayName = 'DateInput';

/* -------------------------------------------------------------------------- */
/*  TimeInput                                                                 */
/* -------------------------------------------------------------------------- */

interface TimeInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

interface TimeParts {
  hours: number;
  minutes: number;
  ampm: 'AM' | 'PM';
}

function toTimeParts(d: Date): TimeParts {
  const hours = d.getHours();
  return {
    hours: hours % 12 === 0 ? 12 : hours % 12,
    minutes: d.getMinutes(),
    ampm: hours >= 12 ? 'PM' : 'AM',
  };
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [time, setTime] = React.useState<TimeParts>(() =>
    toTimeParts(value ? new Date(value) : new Date()),
  );

  const timeRef = React.useRef(time);

  React.useEffect(() => {
    timeRef.current = time;
  }, [time]);

  const hoursRef = React.useRef<HTMLInputElement>(null);
  const minutesRef = React.useRef<HTMLInputElement>(null);

  // Sync from controlled prop
  React.useEffect(() => {
    if (value) {
      setTime(toTimeParts(new Date(value)));
    }
  }, [value]);

  const emitChange = (newTime: TimeParts) => {
    const currentDate = value ? new Date(value) : new Date();
    const hours =
      newTime.ampm === 'PM' && newTime.hours !== 12
        ? newTime.hours + 12
        : newTime.ampm === 'AM' && newTime.hours === 12
          ? 0
          : newTime.hours;

    currentDate.setHours(hours);
    currentDate.setMinutes(newTime.minutes);
    currentDate.setSeconds(0);
    currentDate.setMilliseconds(0);

    setTime(newTime);
    onChange?.(currentDate);
  };

  const handleInputChange =
    (field: 'hours' | 'minutes') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;

      const raw = e.target.value.replace(/\D/g, '');
      if (!raw) return;

      const numValue = Number.parseInt(raw, 10);
      let clamped = numValue;

      if (field === 'hours') {
        if (clamped < 1) clamped = 1;
        else if (clamped > 12) clamped = 12;
      } else {
        if (clamped < 0) clamped = 0;
        else if (clamped > 59) clamped = 59;
      }

      emitChange({ ...timeRef.current, [field]: clamped });

      if (field === 'hours' && raw.length >= 2) {
        minutesRef.current?.focus();
      }
    };

  const handleKeyDown =
    (field: 'hours' | 'minutes') =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey) return;

      if (
        !/^[0-9]$/.test(e.key) &&
        ![
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Delete',
          'Tab',
          'Backspace',
          'Enter',
        ].includes(e.key)
      ) {
        if (e.key === ':') {
          e.preventDefault();
          if (field === 'hours') minutesRef.current?.focus();
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          emitChange({ ...timeRef.current, ampm: 'AM' });
          return;
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          emitChange({ ...timeRef.current, ampm: 'PM' });
          return;
        }
        e.preventDefault();
        return;
      }

      const current = timeRef.current;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (field === 'hours') {
          emitChange({
            ...current,
            hours: current.hours === 12 ? 1 : current.hours + 1,
          });
        } else {
          emitChange({ ...current, minutes: (current.minutes + 1) % 60 });
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (field === 'hours') {
          emitChange({
            ...current,
            hours: current.hours === 1 ? 12 : current.hours - 1,
          });
        } else {
          emitChange({
            ...current,
            minutes: (current.minutes - 1 + 60) % 60,
          });
        }
      }

      if (e.key === 'ArrowRight') {
        const el = e.currentTarget;
        if (
          el.selectionStart === el.value.length ||
          (el.selectionStart === 0 && el.selectionEnd === el.value.length)
        ) {
          e.preventDefault();
          if (field === 'hours') minutesRef.current?.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        const el = e.currentTarget;
        if (
          el.selectionStart === 0 ||
          (el.selectionStart === 0 && el.selectionEnd === el.value.length)
        ) {
          e.preventDefault();
          if (field === 'minutes') hoursRef.current?.focus();
        }
      }
    };

  const incrementHours = () => {
    if (disabled) return;
    const current = timeRef.current;
    emitChange({
      ...current,
      hours: current.hours === 12 ? 1 : current.hours + 1,
    });
  };

  const decrementHours = () => {
    if (disabled) return;
    const current = timeRef.current;
    emitChange({
      ...current,
      hours: current.hours === 1 ? 12 : current.hours - 1,
    });
  };

  const incrementMinutes = () => {
    if (disabled) return;
    const current = timeRef.current;
    emitChange({ ...current, minutes: (current.minutes + 1) % 60 });
  };

  const decrementMinutes = () => {
    if (disabled) return;
    const current = timeRef.current;
    emitChange({ ...current, minutes: (current.minutes - 1 + 60) % 60 });
  };

  const toggleAmPm = () => {
    if (disabled) return;
    const current = timeRef.current;
    emitChange({ ...current, ampm: current.ampm === 'AM' ? 'PM' : 'AM' });
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  const segmentClass =
    'bg-transparent p-0 outline-none border-none text-center text-sm w-10 h-full min-w-0';

  return (
    <div
      data-slot="time-input"
      className={cn('flex items-center gap-1 px-1', className)}
    >
      <div className="flex flex-col items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          onClick={incrementHours}
          disabled={disabled}
          aria-label="Increment hours"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </Button>
        <input
          ref={hoursRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={pad(time.hours)}
          onChange={handleInputChange('hours')}
          onKeyDown={handleKeyDown('hours')}
          onFocus={selectOnFocus}
          className={segmentClass}
          disabled={disabled}
          aria-label="Hours"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          onClick={decrementHours}
          disabled={disabled}
          aria-label="Decrement hours"
        >
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </div>
      <span className="text-muted-foreground text-sm font-medium select-none">
        :
      </span>
      <div className="flex flex-col items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          onClick={incrementMinutes}
          disabled={disabled}
          aria-label="Increment minutes"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </Button>
        <input
          ref={minutesRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={pad(time.minutes)}
          onChange={handleInputChange('minutes')}
          onKeyDown={handleKeyDown('minutes')}
          onFocus={selectOnFocus}
          className={segmentClass}
          disabled={disabled}
          aria-label="Minutes"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          onClick={decrementMinutes}
          disabled={disabled}
          aria-label="Decrement minutes"
        >
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="ml-0.5 h-8 px-2 text-xs"
        onClick={toggleAmPm}
        disabled={disabled}
        aria-label="Toggle AM/PM"
      >
        {time.ampm}
      </Button>
    </div>
  );
};

TimeInput.displayName = 'TimeInput';

/* -------------------------------------------------------------------------- */
/*  DateTimeInput                                                             */
/* -------------------------------------------------------------------------- */

interface DateTimeInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
  label,
}) => {
  // Fully controlled, derive current date from prop, no local state
  const currentDate = value ?? new Date();

  const handleDateChange = (newDate: Date | undefined) => {
    if (disabled || !newDate) return;

    const updated = new Date(newDate);
    updated.setHours(
      currentDate.getHours(),
      currentDate.getMinutes(),
      0,
      0,
    );

    onChange?.(updated);
  };

  const handleTimeChange = (newTime: Date | undefined) => {
    if (disabled || !newTime) return;

    const updated = new Date(currentDate);
    updated.setHours(
      newTime.getHours(),
      newTime.getMinutes(),
      0,
      0,
    );

    onChange?.(updated);
  };

  return (
    <div
      data-slot="date-time-input"
      className={cn('flex flex-col gap-1', className)}
    >
      {label && (
        <span className="text-popover-foreground text-sm font-medium">{label}</span>
      )}
      <div
        className={cn(
          'border-input dark:bg-input/30 flex items-center rounded-md border px-1 py-1 shadow-xs',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <DateInput
          value={currentDate}
          onChange={handleDateChange}
          disabled={disabled}
        />
        <span className="bg-border mx-1 w-px self-stretch shrink-0" />
        <TimeInput
          value={currentDate}
          onChange={handleTimeChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

DateTimeInput.displayName = 'DateTimeInput';

export { DateInput, TimeInput, DateTimeInput };
export type { DateInputProps, TimeInputProps, DateTimeInputProps };
