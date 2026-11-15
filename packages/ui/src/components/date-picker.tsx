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

/** Current year, read once: the dropdown range does not need to be live. */
const CURRENT_YEAR = new Date().getFullYear()

/**
 * `YYYY-MM-DD` → local-midnight `Date`.
 *
 * Parsed by hand, not with `new Date(value)`: the string form is UTC and would
 * land on the previous day west of Greenwich.
 */
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

function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
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
  /** Selected business date as `YYYY-MM-DD`; empty for no selection. */
  value?: string
  onChange: (value: string) => void
  /** Shown while empty. Defaults to `dd/mm/yyyy`, matching how dates are formatted. */
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
  /**
   * Blocks native form submission while empty.
   *
   * A popover button is not a form control, so this renders an off-screen
   * `required` input to keep the browser's own validation working.
   */
  required?: boolean
} & Pick<React.ComponentProps<typeof Button>, "aria-label" | "name">) {
  const selected = parseIsoDate(value)
  const from = parseIsoDate(min)
  const to = parseIsoDate(max)

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
              "w-full justify-start font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
            {...props}
          />
        }
      >
        <span className="flex-1 truncate text-left">
          {selected
            ? selected.toLocaleDateString(undefined, { dateStyle: "medium" })
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
          onSelect={(date) => date && onChange(toIsoDate(date))}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          disabled={[from ? { before: from } : null, to ? { after: to } : null].filter(
            (matcher) => matcher !== null
          )}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
