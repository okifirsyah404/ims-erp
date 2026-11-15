"use client"

import * as React from "react"
import { cn } from "cn"
import { RiCalendarLine } from "@remixicon/react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { TimeColumns } from "@workspace/ui/components/time-picker"
import { formatTime, parseTime } from "@workspace/ui/lib/time"

/** Current year, read once: the dropdown range does not need to be live. */
const CURRENT_YEAR = new Date().getFullYear()

/** `YYYY-MM-DDTHH:mm` → its date and time halves, both optional. */
function parseDateTime(value?: string): { date?: string; time?: string } {
  if (!value) return {}
  const [date, time] = value.split("T")
  return { date: date || undefined, time: time || undefined }
}

/** Local-midnight `Date`, parsed by hand so the value never shifts a day. */
function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Date and time in one popover, for `datetime-local` replacements.
 *
 * The value keeps the `YYYY-MM-DDTHH:mm` shape `toDateTimeInput` /
 * `fromDateTimeInput` already produce, so call sites do not change.
 */
function DateTimePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy --:--",
  className,
  disabled,
  id,
  fromYear = CURRENT_YEAR - 100,
  toYear = CURRENT_YEAR + 10,
  min,
  max,
  required,
  ...props
}: {
  /** Selected moment as `YYYY-MM-DDTHH:mm`; empty for no selection. */
  value?: string
  onChange: (value: string) => void
  /** Shown while empty. Defaults to `dd/mm/yyyy --:--`. */
  placeholder?: React.ReactNode
  className?: string
  disabled?: boolean
  id?: string
  /** First year in the year dropdown. Defaults to 100 years ago. */
  fromYear?: number
  /** Last year in the year dropdown. Defaults to 10 years ahead. */
  toYear?: number
  /** Earliest selectable date, `YYYY-MM-DD`. */
  min?: string
  /** Latest selectable date, `YYYY-MM-DD`. */
  max?: string
  /** Blocks native form submission while empty; see `DatePicker`. */
  required?: boolean
} & Pick<React.ComponentProps<typeof Button>, "aria-label" | "name">) {
  const parsed = parseDateTime(value)
  const selected = parseIsoDate(parsed.date)
  const time = parseTime(parsed.time)
  const from = parseIsoDate(min)
  const to = parseIsoDate(max)

  /** Emit with whichever half is missing filled in, so the value stays valid. */
  const emit = (nextDate?: string, nextTime?: string) => {
    const date = nextDate ?? parsed.date ?? toIsoDate(new Date())
    const clock = nextTime ?? parsed.time ?? "00:00"
    onChange(`${date}T${clock}`)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            id={id}
            aria-required={required || undefined}
            data-empty={selected ? undefined : "true"}
            className={cn(
              "w-full justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
              className
            )}
            {...props}
          />
        }
      >
        <span className="flex-1 truncate text-left">
          {selected
            ? `${selected.toLocaleDateString(undefined, { dateStyle: "medium" })}${
                time ? ` ${formatTime(time.hour, time.minute)}` : ""
              }`
            : placeholder}
        </span>
        {/* Suffix icon, themed by `--muted-foreground` so it follows light/dark. */}
        <RiCalendarLine aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      {required && !disabled && (
        <input
          required
          value={value ?? ""}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      )}
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? from}
          onSelect={(date) => date && emit(toIsoDate(date))}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          disabled={[from ? { before: from } : null, to ? { after: to } : null].filter(
            (matcher) => matcher !== null
          )}
        />
        <div className="border-t p-2">
          <TimeColumns
            hour={time?.hour ?? null}
            minute={time?.minute ?? null}
            className="[&>div]:h-32"
            onPick={(hour, minute) => emit(undefined, formatTime(hour, minute))}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
